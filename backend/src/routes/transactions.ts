import crypto from "node:crypto";
import { ListingCondition, ListingStatus, ListingType, Prisma, Role, TransactionStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { createRateLimit } from "../middleware/rateLimit.js";

const router = Router();

const transactionUpdateRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}:${req.user?.id ?? "anonymous"}:${req.params.id}`,
  message: "Too many transaction attempts. Please try again later."
});

class TransactionRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function presentTransaction<T extends { buyerId: string; otpCode: string | null }>(transaction: T, viewerId: string) {
  const { otpCode, ...safeTransaction } = transaction;
  return {
    ...safeTransaction,
    otpCode: transaction.buyerId === viewerId ? otpCode : undefined
  };
}

async function runSerializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Serializable transaction retry limit reached");
}

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
  res.json({ transactions: transactions.map((transaction) => presentTransaction(transaction, req.user!.id)) });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = z.object({
    listingId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(100).default(1),
    meetupPointId: z.string().uuid().nullable().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid reservation", errors: parsed.error.flatten() });

  const otpCode = crypto.randomInt(100000, 1000000).toString();

  let transaction;
  try {
    transaction = await runSerializable(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: parsed.data.listingId } });
      if (!listing || listing.status !== ListingStatus.ACTIVE) throw new TransactionRequestError(404, "Listing is not available");
      if (listing.sellerId === req.user!.id) throw new TransactionRequestError(400, "You cannot reserve your own listing");

      if (listing.type === ListingType.PRODUCT) {
        const reserved = await tx.transaction.aggregate({
          where: { listingId: listing.id, status: TransactionStatus.RESERVED },
          _sum: { quantity: true }
        });
        const available = listing.quantity - (reserved._sum.quantity ?? 0);
        if (parsed.data.quantity > available) {
          throw new TransactionRequestError(409, `Only ${Math.max(0, available)} item(s) are available`);
        }
      }

      return tx.transaction.create({
        data: {
          listingId: listing.id,
          buyerId: req.user!.id,
          sellerId: listing.sellerId,
          price: listing.price,
          quantity: listing.type === ListingType.PRODUCT ? parsed.data.quantity : 1,
          meetupPointId: parsed.data.meetupPointId,
          otpCode
        },
        include: transactionInclude
      });
    });
  } catch (error) {
    if (error instanceof TransactionRequestError) return res.status(error.status).json({ message: error.message });
    throw error;
  }

  await prisma.notification.create({
    data: { userId: transaction.sellerId, type: "RESERVATION_CREATED", payload: JSON.stringify({ transactionId: transaction.id, listingId: transaction.listingId }) }
  });
  res.status(201).json({ transaction: presentTransaction(transaction, req.user!.id) });
});

router.patch("/:id/status", requireAuth, transactionUpdateRateLimit, async (req, res) => {
  const parsed = z.object({
    status: z.enum(["COMPLETED", "CANCELLED", "DISPUTED"]),
    reason: z.string().trim().max(500).optional(),
    otpCode: z.string().trim().regex(/^\d{4,6}$/).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid transaction update" });

  const existing = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!existing || (existing.buyerId !== req.user!.id && existing.sellerId !== req.user!.id)) {
    return res.status(404).json({ message: "Transaction not found" });
  }
  if (existing.status !== TransactionStatus.RESERVED) return res.status(409).json({ message: "This transaction is already closed" });
  if (parsed.data.status === "COMPLETED") {
    if (existing.sellerId !== req.user!.id) {
      return res.status(403).json({ message: "Only the seller can complete the handoff" });
    }
    if (existing.otpCode && existing.otpCode !== parsed.data.otpCode) {
      return res.status(400).json({ message: "Invalid transaction validation code (OTP)" });
    }
  }
  if (parsed.data.status === "DISPUTED" && !parsed.data.reason) return res.status(400).json({ message: "A dispute reason is required" });

  let transaction;
  try {
    transaction = await runSerializable(async (tx) => {
      const statusUpdate = await tx.transaction.updateMany({
        where: { id: existing.id, status: TransactionStatus.RESERVED },
        data: {
          status: parsed.data.status,
          completedAt: parsed.data.status === "COMPLETED" ? new Date() : undefined,
          cancelledAt: parsed.data.status === "CANCELLED" ? new Date() : undefined,
          disputeReason: parsed.data.status === "DISPUTED" ? parsed.data.reason : undefined
        }
      });
      if (statusUpdate.count !== 1) throw new TransactionRequestError(409, "This transaction is already closed");

      if (parsed.data.status === "COMPLETED" && existing.listing.type === ListingType.PRODUCT) {
        const quantityUpdate = await tx.listing.updateMany({
          where: { id: existing.listingId, quantity: { gte: existing.quantity } },
          data: { quantity: { decrement: existing.quantity } }
        });
        if (quantityUpdate.count !== 1) throw new TransactionRequestError(409, "Listing stock changed. Please retry the handoff.");
        const listing = await tx.listing.findUniqueOrThrow({ where: { id: existing.listingId }, select: { quantity: true } });
        if (listing.quantity === 0) {
          await tx.listing.update({ where: { id: existing.listingId }, data: { status: ListingStatus.SOLD } });
        }
      }

      return tx.transaction.findUniqueOrThrow({ where: { id: existing.id }, include: transactionInclude });
    });
  } catch (error) {
    if (error instanceof TransactionRequestError) return res.status(error.status).json({ message: error.message });
    throw error;
  }
  const recipientId = existing.buyerId === req.user!.id ? existing.sellerId : existing.buyerId;
  await prisma.notification.create({
    data: { userId: recipientId, type: `TRANSACTION_${parsed.data.status}`, payload: JSON.stringify({ transactionId: transaction.id, listingId: transaction.listingId }) }
  });
  res.json({ transaction: presentTransaction(transaction, req.user!.id) });
});

router.post("/messages/:messageId/accept-offer", requireAuth, async (req, res) => {
  const message = await prisma.message.findUnique({
    where: { id: req.params.messageId },
    include: { conversation: true }
  });

  if (!message || !message.offerAmount) {
    return res.status(404).json({ message: "Offer message not found" });
  }

  if (message.conversation.sellerId !== req.user!.id || message.senderId !== message.conversation.buyerId) {
    return res.status(403).json({ message: "Only the seller can accept offers" });
  }

  if (message.offerStatus && message.offerStatus !== "PENDING") {
    return res.status(409).json({ message: "This offer has already been resolved" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const resolved = await tx.message.updateMany({
      where: { id: message.id, OR: [{ offerStatus: null }, { offerStatus: "PENDING" }] },
      data: { offerStatus: "ACCEPTED" }
    });
    if (resolved.count !== 1) return null;

    const updatedMessage = await tx.message.findUniqueOrThrow({ where: { id: message.id } });
    const activeTransaction = await tx.transaction.findFirst({
      where: {
        listingId: message.conversation.listingId,
        buyerId: message.conversation.buyerId,
        sellerId: message.conversation.sellerId,
        status: TransactionStatus.RESERVED
      }
    });
    const updatedTransaction = activeTransaction
      ? await tx.transaction.update({ where: { id: activeTransaction.id }, data: { price: message.offerAmount! }, include: transactionInclude })
      : null;
    return { updatedMessage, updatedTransaction };
  });
  if (!result) return res.status(409).json({ message: "This offer has already been resolved" });
  const { updatedMessage, updatedTransaction } = result;

  res.json({
    message: updatedMessage,
    transaction: updatedTransaction ? presentTransaction(updatedTransaction, req.user!.id) : null
  });
});

router.post("/messages/:messageId/decline-offer", requireAuth, async (req, res) => {
  const message = await prisma.message.findUnique({
    where: { id: req.params.messageId },
    include: { conversation: true }
  });

  if (!message || !message.offerAmount) {
    return res.status(404).json({ message: "Offer message not found" });
  }

  if (message.conversation.sellerId !== req.user!.id || message.senderId !== message.conversation.buyerId) {
    return res.status(403).json({ message: "Only the seller can decline offers" });
  }

  if (message.offerStatus && message.offerStatus !== "PENDING") {
    return res.status(409).json({ message: "This offer has already been resolved" });
  }

  const resolved = await prisma.message.updateMany({
    where: { id: message.id, OR: [{ offerStatus: null }, { offerStatus: "PENDING" }] },
    data: { offerStatus: "DECLINED" }
  });
  if (resolved.count !== 1) return res.status(409).json({ message: "This offer has already been resolved" });
  const updatedMessage = await prisma.message.findUniqueOrThrow({ where: { id: message.id } });

  res.json({ message: updatedMessage });
});

router.post("/:id/review", requireAuth, async (req, res) => {
  const parsed = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Rating must be between 1 and 5" });
  const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!transaction || transaction.buyerId !== req.user!.id) return res.status(404).json({ message: "Transaction not found" });
  if (transaction.status !== TransactionStatus.COMPLETED) return res.status(409).json({ message: "Complete the transaction before reviewing" });

  let review;
  try {
    review = await prisma.review.create({
      data: {
        transactionId: transaction.id,
        reviewerId: req.user!.id,
        revieweeId: transaction.sellerId,
        rating: parsed.data.rating,
        comment: parsed.data.comment
      },
      include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "This transaction has already been reviewed" });
    }
    throw error;
  }
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
