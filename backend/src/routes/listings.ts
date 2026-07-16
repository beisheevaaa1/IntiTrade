import { ListingCondition, ListingStatus, ListingType, Prisma, Role, SellerType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { canAttachMediaUrl } from "../utils/uploadOwnership.js";
import { listingMediaValidationMessage } from "../utils/validation.js";
import { listingInventoryConflict, lockListingInventory } from "../utils/listingInventory.js";

const router = Router();

const listingInclude = Prisma.validator<Prisma.ListingInclude>()({
  seller: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      showEmail: true,
      isVerified: true,
      faculty: true,
      campusArea: true,
      showCampusArea: true,
      avatarUrl: true,
      sellerType: true,
      showAcademicProfile: true,
      resume: true,
      projects: true,
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
  const { reviewsReceived, email, phone, showEmail, campusArea, showCampusArea, ...seller } = listing.seller;
  const rating = reviewsReceived.length
    ? reviewsReceived.reduce((sum, review) => sum + review.rating, 0) / reviewsReceived.length
    : 0;

  const showAcademic = seller.showAcademicProfile;

  return {
    ...listing,
    seller: {
      ...seller,
      email: showEmail ? email : undefined,
      phone: listing.showPhone ? phone : undefined,
      campusArea: showCampusArea ? campusArea : undefined,
      resume: showAcademic ? seller.resume : undefined,
      projects: showAcademic ? seller.projects : undefined,
      rating,
      ratingCount: reviewsReceived.length
    }
  };
}

router.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json({ categories });
});

router.get("/autocomplete", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) return res.json({ suggestions: [] });

  const listings = await prisma.listing.findMany({
    where: {
      status: ListingStatus.ACTIVE,
      title: { contains: q, mode: "insensitive" }
    },
    select: { id: true, title: true },
    take: 8
  });

  res.json({ suggestions: Array.from(new Set(listings.map((l) => l.title))) });
});

router.get("/", async (req, res) => {
  const text = (key: string) => typeof req.query[key] === "string" && req.query[key] ? String(req.query[key]).trim() : undefined;
  const q = text("q") ?? text("search");
  const categories = (text("category") ?? "").split(",").map((value) => value.trim()).filter(Boolean).slice(0, 10);
  const typeValue = text("type");
  const conditionValues = (text("condition") ?? "").split(",").filter((value): value is ListingCondition => value in ListingCondition);
  const sellerTypeValue = text("sellerType");
  const type = typeValue && typeValue in ListingType ? typeValue as ListingType : undefined;
  const sellerType = sellerTypeValue && sellerTypeValue in SellerType ? sellerTypeValue as SellerType : undefined;
  const minPrice = Number(text("minPrice"));
  const maxPrice = Number(text("maxPrice"));
  const minRating = Number(text("minRating"));
  const normalizedMinRating = Number.isFinite(minRating) ? Math.max(1, Math.min(5, minRating)) : undefined;
  const page = Math.max(1, Number.parseInt(text("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(text("limit") ?? "20", 10) || 20));

  const ratedSellerIds = normalizedMinRating === undefined
    ? undefined
    : (await prisma.review.groupBy({
        by: ["revieweeId"],
        having: { rating: { _avg: { gte: normalizedMinRating } } }
      })).map((review) => review.revieweeId);

  const where: Prisma.ListingWhereInput = {
    status: ListingStatus.ACTIVE,
    type,
    condition: conditionValues.length ? { in: conditionValues } : undefined,
    sellerId: text("sellerId"),
    category: categories.length ? { slug: { in: categories } } : undefined,
    location: text("location") ? { contains: text("location"), mode: "insensitive" } : undefined,
    courseCode: text("courseCode") ? { contains: text("courseCode"), mode: "insensitive" } : undefined,
    isbn: text("isbn") ? { contains: text("isbn"), mode: "insensitive" } : undefined,
    seller: sellerType || ratedSellerIds
      ? {
          sellerType,
          id: ratedSellerIds ? { in: ratedSellerIds } : undefined
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
  price: z.coerce.number().min(0).max(1_000_000),
  isNegotiable: z.boolean().optional(),
  showPhone: z.boolean().optional(),
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
  imageUrls: z.array(z.string().max(500)).max(25).optional()
});

async function listingReferenceValidationMessage(categoryId?: string, meetupPointId?: string | null) {
  const [category, meetupPoint] = await Promise.all([
    categoryId ? prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }) : Promise.resolve({ id: "unchanged" }),
    meetupPointId ? prisma.meetupPoint.findUnique({ where: { id: meetupPointId }, select: { id: true, isActive: true } }) : Promise.resolve({ id: "unchanged", isActive: true })
  ]);
  if (!category) return "Category is not available";
  if (!meetupPoint?.isActive) return "Meetup point is not available";
  return null;
}

function isListingReferenceConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

function isListingInventoryDatabaseConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004";
}

class ListingMutationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

router.post("/", requireAuth, async (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing data", errors: parsed.error.flatten() });
  const data = parsed.data;
  const mediaError = listingMediaValidationMessage(data.imageUrls ?? []);
  if (mediaError) return res.status(400).json({ message: mediaError });
  if ((data.imageUrls ?? []).some((url) => !canAttachMediaUrl(req.user!.id, url))) {
    return res.status(403).json({ message: "A listing can only use media uploaded by its seller" });
  }
  const referenceError = await listingReferenceValidationMessage(data.categoryId, data.meetupPointId);
  if (referenceError) return res.status(400).json({ message: referenceError });
  let listing;
  try {
    listing = await prisma.listing.create({
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
        showPhone: data.showPhone ?? false,
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
  } catch (error) {
    if (isListingReferenceConflict(error)) return res.status(400).json({ message: "Category or meetup point is no longer available" });
    if (isListingInventoryDatabaseConflict(error)) {
      return res.status(409).json({ message: "Listing inventory changed while this request was being processed" });
    }
    throw error;
  }
  res.status(201).json({ listing: presentListing(listing) });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const existing = await prisma.listing.findUnique({ where: { id: req.params.id }, include: { images: { select: { url: true } } } });
  if (!existing) return res.status(404).json({ message: "Listing not found" });
  if (existing.sellerId !== req.user!.id) return res.status(403).json({ message: "Only the seller can edit this listing" });
  const parsed = listingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing data", errors: parsed.error.flatten() });
  const { imageUrls, ...data } = parsed.data;
  const mediaError = listingMediaValidationMessage(imageUrls ?? []);
  if (mediaError) return res.status(400).json({ message: mediaError });
  const existingImageUrls = new Set(existing.images.map((image) => image.url));
  if ((imageUrls ?? []).some((url) => !existingImageUrls.has(url) && !canAttachMediaUrl(req.user!.id, url))) {
    return res.status(403).json({ message: "A listing can only use media uploaded by its seller" });
  }
  const referenceError = await listingReferenceValidationMessage(data.categoryId, data.meetupPointId);
  if (referenceError) return res.status(400).json({ message: referenceError });
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      await lockListingInventory(tx, existing.id);
      const current = await tx.listing.findUnique({
        where: { id: existing.id },
        select: { id: true, sellerId: true, type: true, quantity: true, condition: true }
      });
      if (!current) throw new ListingMutationError(404, "Listing not found");
      if (current.sellerId !== req.user!.id) throw new ListingMutationError(403, "Only the seller can edit this listing");

      const nextType = data.type ?? current.type;
      const nextQuantity = nextType === ListingType.PRODUCT ? data.quantity ?? current.quantity : 1;
      const inventoryConflict = await listingInventoryConflict(tx, {
        listingId: current.id,
        nextType,
        nextQuantity
      });
      if (inventoryConflict) throw new ListingMutationError(409, inventoryConflict.message);

      const updateData: Prisma.ListingUncheckedUpdateInput = {
        ...data,
        quantity: data.type !== undefined || data.quantity !== undefined ? nextQuantity : undefined,
        isRecurring: data.type ? data.type !== ListingType.PRODUCT : undefined,
        condition: data.type
          ? data.type === ListingType.PRODUCT
            ? data.condition ?? (current.type === ListingType.PRODUCT ? current.condition : ListingCondition.GOOD)
            : ListingCondition.NOT_APPLICABLE
          : data.condition,
        status: ListingStatus.PENDING,
        images: imageUrls ? { deleteMany: {}, create: imageUrls.map((url) => ({ url })) } : undefined
      };
      return tx.listing.update({
        where: { id: current.id },
        data: updateData,
        include: listingInclude
      });
    });
  } catch (error) {
    if (error instanceof ListingMutationError) return res.status(error.status).json({ message: error.message });
    if (isListingReferenceConflict(error)) return res.status(400).json({ message: "Category or meetup point is no longer available" });
    if (isListingInventoryDatabaseConflict(error)) {
      return res.status(409).json({ message: "Listing inventory changed while this request was being processed" });
    }
    throw error;
  }
  res.json({ listing: presentListing(updated) });
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  const parsed = z.object({ status: z.nativeEnum(ListingStatus) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing status" });
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      await lockListingInventory(tx, req.params.id);
      const listing = await tx.listing.findUnique({ where: { id: req.params.id } });
      if (!listing) return { outcome: "NOT_FOUND" as const };
      const sellerStatuses: ListingStatus[] = [ListingStatus.SOLD, ListingStatus.ARCHIVED];
      const sellerAllowed = listing.sellerId === req.user!.id && sellerStatuses.includes(parsed.data.status);
      if (!sellerAllowed) return { outcome: "FORBIDDEN" as const };
      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: { status: parsed.data.status },
        include: listingInclude
      });
      return { outcome: "UPDATED" as const, listing: updated };
    });
  } catch (error) {
    if (isListingInventoryDatabaseConflict(error)) {
      return res.status(409).json({ message: "Listing inventory changed while this request was being processed" });
    }
    throw error;
  }
  if (result.outcome === "NOT_FOUND") return res.status(404).json({ message: "Listing not found" });
  if (result.outcome === "FORBIDDEN") return res.status(403).json({ message: "Only the seller can change this listing status" });
  res.json({ listing: presentListing(result.listing) });
});

export default router;
