import { ListingCondition, ListingStatus, ListingType, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const router = Router();

const listingInclude = {
  seller: { select: { id: true, name: true, email: true } },
  category: true,
  images: true,
  _count: { select: { favorites: true, reports: true } }
};

router.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json({ categories });
});

router.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const type = typeof req.query.type === "string" && req.query.type in ListingType ? (req.query.type as ListingType) : undefined;
  const minPrice = typeof req.query.minPrice === "string" ? Number(req.query.minPrice) : undefined;
  const maxPrice = typeof req.query.maxPrice === "string" ? Number(req.query.maxPrice) : undefined;
  const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";
  const status = req.user?.role === Role.ADMIN && typeof req.query.status === "string" && req.query.status in ListingStatus
    ? (req.query.status as ListingStatus)
    : ListingStatus.ACTIVE;

  const listings = await prisma.listing.findMany({
    where: {
      status,
      type,
      category: category ? { slug: category } : undefined,
      price: {
        gte: Number.isFinite(minPrice) ? minPrice : undefined,
        lte: Number.isFinite(maxPrice) ? maxPrice : undefined
      },
      OR: q
        ? [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } }
          ]
        : undefined
    },
    include: listingInclude,
    orderBy: sort === "price_asc" ? { price: "asc" } : sort === "price_desc" ? { price: "desc" } : { createdAt: "desc" }
  });

  res.json({ listings });
});

router.get("/mine", requireAuth, async (req, res) => {
  const listings = await prisma.listing.findMany({
    where: { sellerId: req.user!.id },
    include: listingInclude,
    orderBy: { createdAt: "desc" }
  });
  res.json({ listings });
});

router.get("/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id }, include: listingInclude });
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  res.json({ listing });
});

const createListingSchema = z.object({
  title: z.string().min(4).max(120),
  description: z.string().min(10).max(2000),
  price: z.coerce.number().min(0),
  type: z.nativeEnum(ListingType),
  condition: z.nativeEnum(ListingCondition).optional(),
  location: z.string().min(2).max(120),
  categoryId: z.string().uuid(),
  imageUrls: z.array(z.string()).default([])
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing data", errors: parsed.error.flatten() });

  const listing = await prisma.listing.create({
    data: {
      ...parsed.data,
      price: parsed.data.price,
      condition: parsed.data.type === ListingType.SERVICE ? ListingCondition.NOT_APPLICABLE : parsed.data.condition ?? ListingCondition.GOOD,
      sellerId: req.user!.id,
      images: { create: parsed.data.imageUrls.map((url) => ({ url })) }
    },
    include: listingInclude
  });

  res.status(201).json({ listing });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  if (listing.sellerId !== req.user!.id && req.user!.role !== Role.ADMIN) return res.status(403).json({ message: "Not allowed" });

  const parsed = createListingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing data", errors: parsed.error.flatten() });

  const updated = await prisma.listing.update({
    where: { id: req.params.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      type: parsed.data.type,
      condition: parsed.data.condition,
      location: parsed.data.location,
      categoryId: parsed.data.categoryId
    },
    include: listingInclude
  });

  res.json({ listing: updated });
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  const parsed = z.object({ status: z.nativeEnum(ListingStatus) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing status" });

  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  const sellerAllowed = listing.sellerId === req.user!.id && ["SOLD", "ARCHIVED"].includes(parsed.data.status);
  if (!sellerAllowed && req.user!.role !== Role.ADMIN) return res.status(403).json({ message: "Not allowed" });

  const updated = await prisma.listing.update({ where: { id: req.params.id }, data: { status: parsed.data.status }, include: listingInclude });
  res.json({ listing: updated });
});

export default router;
