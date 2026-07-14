import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ListingStatus } from "@prisma/client";
import { z } from "zod";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const favorites = await prisma.favorite.findMany({
    where: { userId: req.user!.id },
    include: {
      listing: {
        include: {
          seller: { select: { id: true, name: true, avatarUrl: true, sellerType: true } },
          category: true,
          images: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ favorites });
});

router.post("/:listingId", requireAuth, async (req, res) => {
  const listingId = z.string().uuid().safeParse(req.params.listingId);
  if (!listingId.success) return res.status(400).json({ message: "Invalid listing" });
  const listing = await prisma.listing.findUnique({ where: { id: listingId.data }, select: { status: true } });
  if (!listing || listing.status !== ListingStatus.ACTIVE) return res.status(404).json({ message: "Listing not found" });
  const favorite = await prisma.favorite.upsert({
    where: { userId_listingId: { userId: req.user!.id, listingId: listingId.data } },
    update: {},
    create: { userId: req.user!.id, listingId: listingId.data }
  });
  res.status(201).json({ favorite });
});

router.delete("/:listingId", requireAuth, async (req, res) => {
  const listingId = z.string().uuid().safeParse(req.params.listingId);
  if (!listingId.success) return res.status(400).json({ message: "Invalid listing" });
  await prisma.favorite.deleteMany({ where: { userId: req.user!.id, listingId: listingId.data } });
  res.status(204).send();
});

export default router;
