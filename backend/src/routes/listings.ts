import { ListingCondition, ListingStatus, ListingType, Prisma, Role, SellerType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const router = Router();

const listingInclude = Prisma.validator<Prisma.ListingInclude>()({
  seller: {
    select: {
      id: true,
      name: true,
      email: true,
      showEmail: true,
      isVerified: true,
      faculty: true,
      campusArea: true,
      showCampusArea: true,
      avatarUrl: true,
      sellerType: true,
      reviewsReceived: { select: { rating: true } }
    }
  },
  category: true,
  images: true,
  meetupPoint: true,
  _count: { select: { favorites: true, reports: true } }
});

type ListingPayload = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

function presentListing(listing: ListingPayload) {
  const { reviewsReceived, email, showEmail, campusArea, showCampusArea, ...seller } = listing.seller;
  const rating = reviewsReceived.length
    ? reviewsReceived.reduce((sum, review) => sum + review.rating, 0) / reviewsReceived.length
    : 0;
  return {
    ...listing,
    seller: {
      ...seller,
      email: showEmail ? email : undefined,
      campusArea: showCampusArea ? campusArea : undefined,
      rating,
      ratingCount: reviewsReceived.length
    }
  };
}

router.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json({ categories });
});

router.get("/", async (req, res) => {
  const text = (key: string) => typeof req.query[key] === "string" && req.query[key] ? String(req.query[key]).trim() : undefined;
  const q = text("q") ?? text("search");
  const category = text("category");
  const typeValue = text("type");
  const conditionValues = (text("condition") ?? "").split(",").filter((value): value is ListingCondition => value in ListingCondition);
  const sellerTypeValue = text("sellerType");
  const type = typeValue && typeValue in ListingType ? typeValue as ListingType : undefined;
  const sellerType = sellerTypeValue && sellerTypeValue in SellerType ? sellerTypeValue as SellerType : undefined;
  const minPrice = Number(text("minPrice"));
  const maxPrice = Number(text("maxPrice"));
  const minRating = Number(text("minRating"));
  const page = Math.max(1, Number.parseInt(text("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(text("limit") ?? "20", 10) || 20));

  const where: Prisma.ListingWhereInput = {
    status: ListingStatus.ACTIVE,
    type,
    condition: conditionValues.length ? { in: conditionValues } : undefined,
    sellerId: text("sellerId"),
    category: category ? { slug: category } : undefined,
    location: text("location") ? { contains: text("location"), mode: "insensitive" } : undefined,
    courseCode: text("courseCode") ? { contains: text("courseCode"), mode: "insensitive" } : undefined,
    isbn: text("isbn") ? { contains: text("isbn"), mode: "insensitive" } : undefined,
    seller: sellerType || Number.isFinite(minRating)
      ? {
          sellerType,
          reviewsReceived: Number.isFinite(minRating)
            ? { some: { rating: { gte: Math.max(1, Math.min(5, minRating)) } } }
            : undefined
        }
      : undefined,
    price: {
      gte: Number.isFinite(minPrice) ? minPrice : undefined,
      lte: Number.isFinite(maxPrice) ? maxPrice : undefined
    },
    OR: q
      ? [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { isbn: { contains: q, mode: "insensitive" } },
          { author: { contains: q, mode: "insensitive" } },
          { courseCode: { contains: q, mode: "insensitive" } }
        ]
      : undefined
  };

  const sort = text("sort") ?? text("sortBy");
  const sortOrder = text("sortOrder") === "asc" ? "asc" : "desc";
  let orderBy: Prisma.ListingOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "price" || sort === "price_asc") orderBy = { price: sort === "price_asc" ? "asc" : sortOrder };
  else if (sort === "price_desc") orderBy = { price: "desc" };
  else if (sort === "viewsCount" || sort === "popularity" || sort === "views") orderBy = { viewsCount: "desc" };
  else if (sort === "title") orderBy = { title: sortOrder };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({ where, include: listingInclude, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.listing.count({ where })
  ]);
  res.json({ listings: listings.map(presentListing), pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

router.get("/mine", requireAuth, async (req, res) => {
  const listings = await prisma.listing.findMany({
    where: { sellerId: req.user!.id },
    include: listingInclude,
    orderBy: { createdAt: "desc" }
  });
  res.json({ listings: listings.map(presentListing) });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id }, include: listingInclude });
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  const canPreview = req.user?.role === Role.ADMIN || req.user?.id === listing.sellerId;
  if (listing.status !== ListingStatus.ACTIVE && !canPreview) return res.status(404).json({ message: "Listing not found" });
  void prisma.listing.update({ where: { id: listing.id }, data: { viewsCount: { increment: 1 } } }).catch(() => undefined);
  res.json({ listing: presentListing(listing) });
});

const listingSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(2000),
  price: z.coerce.number().min(0),
  isNegotiable: z.boolean().optional(),
  type: z.nativeEnum(ListingType),
  condition: z.nativeEnum(ListingCondition).optional(),
  location: z.string().trim().min(2).max(120),
  meetupPreference: z.string().trim().max(200).optional(),
  meetupPointId: z.string().uuid().nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(10000).optional(),
  isbn: z.string().trim().max(30).optional(),
  author: z.string().trim().max(120).optional(),
  edition: z.string().trim().max(80).optional(),
  courseCode: z.string().trim().max(40).optional(),
  serviceDuration: z.coerce.number().int().min(15).max(1440).optional(),
  pricingUnit: z.enum(["ITEM", "HOUR", "SESSION", "COURSE"]).optional(),
  availabilityNote: z.string().trim().max(300).optional(),
  categoryId: z.string().uuid(),
  imageUrls: z.array(z.string().max(500)).max(6).optional()
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing data", errors: parsed.error.flatten() });
  const data = parsed.data;
  const listing = await prisma.listing.create({
    data: {
      title: data.title,
      description: data.description,
      price: data.price,
      type: data.type,
      condition: data.type === ListingType.PRODUCT ? data.condition ?? ListingCondition.GOOD : ListingCondition.NOT_APPLICABLE,
      location: data.location,
      meetupPreference: data.meetupPreference,
      meetupPointId: data.meetupPointId,
      quantity: data.type === ListingType.PRODUCT ? data.quantity ?? 1 : 1,
      isRecurring: data.type !== ListingType.PRODUCT,
      isNegotiable: data.isNegotiable ?? false,
      isbn: data.isbn,
      author: data.author,
      edition: data.edition,
      courseCode: data.courseCode,
      serviceDuration: data.serviceDuration,
      pricingUnit: data.pricingUnit,
      availabilityNote: data.availabilityNote,
      categoryId: data.categoryId,
      sellerId: req.user!.id,
      status: ListingStatus.PENDING,
      images: { create: (data.imageUrls ?? []).map((url) => ({ url })) }
    },
    include: listingInclude
  });
  res.status(201).json({ listing: presentListing(listing) });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Listing not found" });
  if (existing.sellerId !== req.user!.id && req.user!.role !== Role.ADMIN) return res.status(403).json({ message: "Not allowed" });
  const parsed = listingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing data", errors: parsed.error.flatten() });
  const { imageUrls, ...data } = parsed.data;
  const updateData: Prisma.ListingUncheckedUpdateInput = {
    ...data,
    isRecurring: data.type ? data.type !== ListingType.PRODUCT : undefined,
    condition: data.type && data.type !== ListingType.PRODUCT ? ListingCondition.NOT_APPLICABLE : data.condition,
    status: req.user!.role === Role.ADMIN ? undefined : ListingStatus.PENDING,
    images: imageUrls ? { deleteMany: {}, create: imageUrls.map((url) => ({ url })) } : undefined
  };
  const updated = await prisma.listing.update({
    where: { id: existing.id },
    data: updateData,
    include: listingInclude
  });
  res.json({ listing: presentListing(updated) });
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  const parsed = z.object({ status: z.nativeEnum(ListingStatus) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing status" });
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  const sellerStatuses: ListingStatus[] = [ListingStatus.SOLD, ListingStatus.ARCHIVED];
  const sellerAllowed = listing.sellerId === req.user!.id && sellerStatuses.includes(parsed.data.status);
  if (!sellerAllowed && req.user!.role !== Role.ADMIN) return res.status(403).json({ message: "Not allowed" });
  const updated = await prisma.listing.update({ where: { id: listing.id }, data: { status: parsed.data.status }, include: listingInclude });
  res.json({ listing: presentListing(updated) });
});

export default router;
