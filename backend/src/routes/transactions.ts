import crypto from "node:crypto";
import { ListingStatus, ListingType, Prisma, TransactionStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { createApprovedListingSnapshot, listingSnapshotInclude, presentHistoricalListing } from "../utils/listingSnapshot.js";
import {
  INVENTORY_HOLD_STATUSES,
  lockListingInventory,
  settleProductInventory,
  transactionListingType
} from "../utils/listingInventory.js";

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

function knownRequestError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function normalizeTransactionDatabaseError(error: unknown) {
  if (knownRequestError(error, "P2002")) {
    return new TransactionRequestError(409, "An active reservation already exists for this buyer and listing");
  }
  if (knownRequestError(error, "P2003")) {
    return new TransactionRequestError(409, "A referenced listing, account, or meetup point is no longer available");
  }
  if (knownRequestError(error, "P2004")) {
    return new TransactionRequestError(409, "The inventory changed while this request was being processed");
  }
  if (knownRequestError(error, "P2025")) {
    return new TransactionRequestError(409, "The transaction changed while this request was being processed");
  }
  return null;
}

function presentTransaction<T extends {
  buyerId: string;
  sellerId: string;
  otpCode: string | null;
  listingSnapshot: Prisma.JsonValue | null;
  listing: { id: string; sellerId: string; status: ListingStatus; [key: string]: unknown };
}>(transaction: T, viewerId: string) {
  const { otpCode, listingSnapshot, listing, ...safeTransaction } = transaction;
  return {
    ...safeTransaction,
    listing: presentHistoricalListing(listing, listingSnapshot),
    otpCode: transaction.buyerId === viewerId ? otpCode : undefined
  };
}

async function runSerializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (knownRequestError(error, "P2034")) {
        if (attempt < 2) continue;
        throw new TransactionRequestError(409, "The transaction changed concurrently. Please retry.");
      }
      throw error;
    }
  }
  throw new Error("Serializable transaction retry limit reached");
}

const transactionInclude = {
  listing: { include: listingSnapshotInclude },
  buyer: { select: { id: true, name: true, avatarUrl: true } },
  seller: { select: { id: true, name: true, avatarUrl: true, sellerType: true } },
  meetupPoint: true,
  reviews: true
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

  let reservation;
  try {
    reservation = await runSerializable(async (tx) => {
      await lockListingInventory(tx, parsed.data.listingId);
      const listing = await tx.listing.findUnique({
        where: { id: parsed.data.listingId },
        include: listingSnapshotInclude
      });
      if (!listing) throw new TransactionRequestError(404, "Listing is not available");
      if (listing.sellerId === req.user!.id) throw new TransactionRequestError(400, "You cannot reserve your own listing");

      const requestedQuantity = listing.type === ListingType.PRODUCT ? parsed.data.quantity : 1;
      const requestedMeetupPointId = parsed.data.meetupPointId ?? null;
      const existingReservations = await tx.transaction.findMany({
        where: {
          listingId: listing.id,
          buyerId: req.user!.id,
          status: { in: INVENTORY_HOLD_STATUSES }
        },
        include: transactionInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 2
      });
      if (existingReservations.length > 1) {
        throw new TransactionRequestError(409, "Multiple active reservations already exist. Please contact support.");
      }
      const existingReservation = existingReservations[0];
      if (existingReservation) {
        const isIdentical = existingReservation.status === TransactionStatus.RESERVED
          && existingReservation.quantity === requestedQuantity
          && (existingReservation.meetupPointId ?? null) === requestedMeetupPointId;
        if (isIdentical) return { transaction: existingReservation, created: false };
        throw new TransactionRequestError(409, "You already have an active reservation for this listing");
      }

      if (listing.status !== ListingStatus.ACTIVE) throw new TransactionRequestError(404, "Listing is not available");

      if (requestedMeetupPointId) {
        const meetupPoint = await tx.meetupPoint.findUnique({
          where: { id: requestedMeetupPointId },
          select: { id: true, isActive: true }
        });
        if (!meetupPoint?.isActive) throw new TransactionRequestError(400, "Meetup point is not available");
      }

      if (listing.type === ListingType.PRODUCT) {
        const reserved = await tx.transaction.aggregate({
          where: { listingId: listing.id, status: { in: INVENTORY_HOLD_STATUSES } },
          _sum: { quantity: true }
        });
        const available = listing.quantity - (reserved._sum.quantity ?? 0);
        if (requestedQuantity > available) {
          throw new TransactionRequestError(409, `Only ${Math.max(0, available)} item(s) are available`);
        }
      }

      const transaction = await tx.transaction.create({
        data: {
          listingId: listing.id,
          listingSnapshot: createApprovedListingSnapshot(listing),
          buyerId: req.user!.id,
          sellerId: listing.sellerId,
          price: listing.price,
          quantity: requestedQuantity,
          meetupPointId: requestedMeetupPointId,
          otpCode
        },
        include: transactionInclude
      });
      await tx.notification.create({
        data: {
          userId: transaction.sellerId,
          type: "RESERVATION_CREATED",
          payload: JSON.stringify({ transactionId: transaction.id, listingId: transaction.listingId })
        }
      });
      return { transaction, created: true };
    });
  } catch (error) {
    if (error instanceof TransactionRequestError) return res.status(error.status).json({ message: error.message });
    const normalized = normalizeTransactionDatabaseError(error);
    if (normalized) return res.status(normalized.status).json({ message: normalized.message });
    throw error;
  }

  res.status(reservation.created ? 201 : 200).json({
    transaction: presentTransaction(reservation.transaction, req.user!.id),
    created: reservation.created
  });
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
      await lockListingInventory(tx, existing.listingId);
      const reservedListingType = parsed.data.status === "COMPLETED"
        ? transactionListingType(existing.listingSnapshot, existing.listingId)
        : null;
      if (parsed.data.status === "COMPLETED" && reservedListingType === null) {
        throw new TransactionRequestError(
          409,
          "Reservation inventory evidence is incomplete. Ask an administrator to resolve it."
        );
      }
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

      if (parsed.data.status === "COMPLETED" && reservedListingType === ListingType.PRODUCT) {
        const settled = await settleProductInventory(tx, existing.listingId, existing.quantity);
        if (!settled) throw new TransactionRequestError(409, "Listing stock changed. Please retry the handoff.");
      }

      const updatedTransaction = await tx.transaction.findUniqueOrThrow({ where: { id: existing.id }, include: transactionInclude });
      const recipientId = existing.buyerId === req.user!.id ? existing.sellerId : existing.buyerId;
      await tx.notification.create({
        data: {
          userId: recipientId,
          type: `TRANSACTION_${parsed.data.status}`,
          payload: JSON.stringify({ transactionId: updatedTransaction.id, listingId: updatedTransaction.listingId })
        }
      });
      return updatedTransaction;
    });
  } catch (error) {
    if (error instanceof TransactionRequestError) return res.status(error.status).json({ message: error.message });
    const normalized = normalizeTransactionDatabaseError(error);
    if (normalized) return res.status(normalized.status).json({ message: normalized.message });
    throw error;
  }
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

  let result;
  try {
    result = await runSerializable(async (tx) => {
      await lockListingInventory(tx, message.conversation.listingId);
      const activeTransactions = await tx.transaction.findMany({
        where: {
          listingId: message.conversation.listingId,
          buyerId: message.conversation.buyerId,
          sellerId: message.conversation.sellerId,
          status: { in: INVENTORY_HOLD_STATUSES }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 2
      });
      if (activeTransactions.length > 1) {
        throw new TransactionRequestError(409, "Multiple active reservations exist. Resolve them before accepting an offer.");
      }
      if (activeTransactions[0]?.status === TransactionStatus.DISPUTED) {
        throw new TransactionRequestError(409, "Resolve the disputed transaction before accepting an offer.");
      }

      const resolved = await tx.message.updateMany({
        where: { id: message.id, OR: [{ offerStatus: null }, { offerStatus: "PENDING" }] },
        data: { offerStatus: "ACCEPTED" }
      });
      if (resolved.count !== 1) return null;

      const updatedMessage = await tx.message.findUniqueOrThrow({ where: { id: message.id } });
      const activeTransaction = activeTransactions[0];
      const updatedTransaction = activeTransaction
        ? await tx.transaction.update({ where: { id: activeTransaction.id }, data: { price: message.offerAmount! }, include: transactionInclude })
        : null;
      return { updatedMessage, updatedTransaction };
    });
  } catch (error) {
    if (error instanceof TransactionRequestError) return res.status(error.status).json({ message: error.message });
    const normalized = normalizeTransactionDatabaseError(error);
    if (normalized) return res.status(normalized.status).json({ message: normalized.message });
    throw error;
  }
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

  let updatedMessage;
  try {
    const resolved = await prisma.message.updateMany({
      where: { id: message.id, OR: [{ offerStatus: null }, { offerStatus: "PENDING" }] },
      data: { offerStatus: "DECLINED" }
    });
    if (resolved.count !== 1) return res.status(409).json({ message: "This offer has already been resolved" });
    updatedMessage = await prisma.message.findUniqueOrThrow({ where: { id: message.id } });
  } catch (error) {
    const normalized = normalizeTransactionDatabaseError(error);
    if (normalized) return res.status(normalized.status).json({ message: normalized.message });
    throw error;
  }

  res.json({ message: updatedMessage });
});

router.post("/:id/review", requireAuth, async (req, res) => {
  const parsed = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Rating must be between 1 and 5" });
  const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  const isBuyer = transaction?.buyerId === req.user!.id;
  const isSeller = transaction?.sellerId === req.user!.id;
  if (!transaction || (!isBuyer && !isSeller)) return res.status(404).json({ message: "Transaction not found" });
  if (transaction.status !== TransactionStatus.COMPLETED) return res.status(409).json({ message: "Complete the transaction before reviewing" });
  const revieweeId = isBuyer ? transaction.sellerId : transaction.buyerId;

  let review;
  try {
    review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          transactionId: transaction.id,
          reviewerId: req.user!.id,
          revieweeId,
          rating: parsed.data.rating,
          comment: parsed.data.comment
        },
        include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } }
      });
      await tx.notification.create({
        data: {
          userId: revieweeId,
          type: "REVIEW_RECEIVED",
          payload: JSON.stringify({ reviewId: created.id, transactionId: transaction.id })
        }
      });
      return created;
    });
  } catch (error) {
    if (knownRequestError(error, "P2002")) {
      return res.status(409).json({ message: "You already reviewed this transaction" });
    }
    const normalized = normalizeTransactionDatabaseError(error);
    if (normalized) return res.status(normalized.status).json({ message: normalized.message });
    throw error;
  }
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
