import { ListingStatus, ListingType, TransactionStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const router = Router();

const transactionInclude = {
  listing: { include: { images: true, category: true, meetupPoint: true } },
  buyer: { select: { id: true, name: true, avatarUrl: true } },
  seller: { select: { id: true, name: true, avatarUrl: true, sellerType: true } },
  meetupPoint: true,
  review: true
};

router.get("/", requireAuth, async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] },
    include: transactionInclude,
    orderBy: { createdAt: "desc" }
  });
  res.json({ transactions });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = z.object({
    listingId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(100).default(1),
    meetupPointId: z.string().uuid().nullable().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid reservation", errors: parsed.error.flatten() });

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing || listing.status !== ListingStatus.ACTIVE) return res.status(404).json({ message: "Listing is not available" });
  if (listing.sellerId === req.user!.id) return res.status(400).json({ message: "You cannot reserve your own listing" });

  if (listing.type === ListingType.PRODUCT) {
    const reserved = await prisma.transaction.aggregate({
      where: { listingId: listing.id, status: TransactionStatus.RESERVED },
      _sum: { quantity: true }
    });
    const available = listing.quantity - (reserved._sum.quantity ?? 0);
    if (parsed.data.quantity > available) return res.status(409).json({ message: `Only ${Math.max(0, available)} item(s) are available` });
  }

  const transaction = await prisma.transaction.create({
    data: {
      listingId: listing.id,
      buyerId: req.user!.id,
      sellerId: listing.sellerId,
      price: listing.price,
      quantity: listing.type === ListingType.PRODUCT ? parsed.data.quantity : 1,
      meetupPointId: parsed.data.meetupPointId
    },
    include: transactionInclude
  });

  await prisma.notification.create({
    data: { userId: listing.sellerId, type: "RESERVATION_CREATED", payload: JSON.stringify({ transactionId: transaction.id, listingId: listing.id }) }
  });
  res.status(201).json({ transaction });
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  const parsed = z.object({
    status: z.enum(["COMPLETED", "CANCELLED", "DISPUTED"]),
    reason: z.string().trim().max(500).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid transaction update" });

  const existing = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!existing || (existing.buyerId !== req.user!.id && existing.sellerId !== req.user!.id)) {
    return res.status(404).json({ message: "Transaction not found" });
  }
  if (existing.status !== TransactionStatus.RESERVED) return res.status(409).json({ message: "This transaction is already closed" });
  if (parsed.data.status === "COMPLETED" && existing.sellerId !== req.user!.id) {
    return res.status(403).json({ message: "Only the seller can complete the handoff" });
  }
  if (parsed.data.status === "DISPUTED" && !parsed.data.reason) return res.status(400).json({ message: "A dispute reason is required" });

  const transaction = await prisma.$transaction(async (tx) => {
    if (parsed.data.status === "COMPLETED" && existing.listing.type === ListingType.PRODUCT) {
      const remaining = Math.max(0, existing.listing.quantity - existing.quantity);
      await tx.listing.update({
        where: { id: existing.listingId },
        data: { quantity: remaining, status: remaining === 0 ? ListingStatus.SOLD : ListingStatus.ACTIVE }
      });
    }
    return tx.transaction.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        completedAt: parsed.data.status === "COMPLETED" ? new Date() : undefined,
        cancelledAt: parsed.data.status === "CANCELLED" ? new Date() : undefined,
        disputeReason: parsed.data.status === "DISPUTED" ? parsed.data.reason : undefined
      },
      include: transactionInclude
    });
  });
  const recipientId = existing.buyerId === req.user!.id ? existing.sellerId : existing.buyerId;
  await prisma.notification.create({
    data: { userId: recipientId, type: `TRANSACTION_${parsed.data.status}`, payload: JSON.stringify({ transactionId: transaction.id, listingId: transaction.listingId }) }
  });
  res.json({ transaction });
});

router.post("/:id/review", requireAuth, async (req, res) => {
  const parsed = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Rating must be between 1 and 5" });
  const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!transaction || transaction.buyerId !== req.user!.id) return res.status(404).json({ message: "Transaction not found" });
  if (transaction.status !== TransactionStatus.COMPLETED) return res.status(409).json({ message: "Complete the transaction before reviewing" });

  const review = await prisma.review.create({
    data: {
      transactionId: transaction.id,
      reviewerId: req.user!.id,
      revieweeId: transaction.sellerId,
      rating: parsed.data.rating,
      comment: parsed.data.comment
    },
    include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } }
  });
  await prisma.notification.create({
    data: { userId: transaction.sellerId, type: "REVIEW_RECEIVED", payload: JSON.stringify({ reviewId: review.id, transactionId: transaction.id }) }
  });
  res.status(201).json({ review });
});

router.get("/seller/:sellerId/reviews", async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { revieweeId: req.params.sellerId },
    include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  const summary = await prisma.review.aggregate({ where: { revieweeId: req.params.sellerId }, _avg: { rating: true }, _count: true });
  res.json({ reviews, summary: { average: summary._avg.rating ?? 0, count: summary._count } });
});

export default router;
