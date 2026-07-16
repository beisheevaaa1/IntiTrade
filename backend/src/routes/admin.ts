import { AnnouncementStatus, ListingStatus, ListingType, Prisma, ReportStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { checkReadiness } from "../health.js";
import { getMonitoringSnapshot } from "../monitoring.js";
import { writeAdminAction } from "../services/adminAudit.js";
import { canChangeUserBlock, canModerateListing } from "../utils/adminRules.js";
import { presentHistoricalListing } from "../utils/listingSnapshot.js";
import {
  listingInventoryConflict,
  lockListingInventory,
  settleProductInventory,
  transactionListingType
} from "../utils/listingInventory.js";
import { lockMessageAccounts } from "../utils/messageLocks.js";

const router = Router();
router.use(requireAuth, requireAdmin);

class AdminMutationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isAdminInventoryDatabaseConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004";
}

const historicalListingSelect = {
  id: true,
  title: true,
  price: true,
  sellerId: true,
  status: true
} as const;

function presentAdminTransaction<T extends {
  listingSnapshot: Prisma.JsonValue | null;
  listing: { id: string; sellerId: string; status: ListingStatus; [key: string]: unknown };
}>(transaction: T) {
  const { listingSnapshot, listing, ...safeTransaction } = transaction;
  return {
    ...safeTransaction,
    listing: presentHistoricalListing(listing, listingSnapshot)
  };
}

router.get("/overview", async (_req, res) => {
  const [pendingListings, openReports, users, activeListings, openSupportTickets] = await Promise.all([
    prisma.listing.count({ where: { status: ListingStatus.PENDING } }),
    prisma.report.count({ where: { status: ReportStatus.OPEN } }),
    prisma.user.count(),
    prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER"] } } })
  ]);
  res.json({ pendingListings, openReports, users, activeListings, openSupportTickets });
});

router.get("/system", async (_req, res) => {
  const readiness = await checkReadiness();
  res.json({ readiness, monitoring: getMonitoringSnapshot() });
});

router.get("/listings", async (_req, res) => {
  const listings = await prisma.listing.findMany({
    include: { seller: { select: { id: true, name: true, email: true } }, category: true, images: true },
    orderBy: { createdAt: "desc" }
  });
  res.json({ listings });
});

router.patch("/listings/:id/status", async (req, res) => {
  const parsed = z.object({ 
    status: z.nativeEnum(ListingStatus),
    rejectionReason: z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success || (parsed.data.status === ListingStatus.REJECTED && !parsed.data.rejectionReason?.trim())) {
    return res.status(400).json({ message: "A valid status and rejection reason are required" });
  }
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      await lockListingInventory(tx, req.params.id);
      const current = await tx.listing.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          sellerId: true,
          status: true,
          rejectionReason: true,
          updatedAt: true,
          type: true,
          quantity: true
        }
      });
      if (!current) return { outcome: "NOT_FOUND" as const };
      if (!canModerateListing(current.status, parsed.data.status)) return { outcome: "INVALID_TRANSITION" as const };
      if (parsed.data.status === ListingStatus.ACTIVE) {
        const inventoryConflict = await listingInventoryConflict(tx, {
          listingId: current.id,
          nextType: current.type,
          nextQuantity: current.quantity
        });
        if (inventoryConflict) {
          return { outcome: "INVENTORY_CONFLICT" as const, message: inventoryConflict.message };
        }
      }

      const claimed = await tx.listing.updateMany({
        where: { id: current.id, status: current.status, updatedAt: current.updatedAt },
        data: {
          status: parsed.data.status,
          rejectionReason: parsed.data.status === ListingStatus.REJECTED ? parsed.data.rejectionReason?.trim() : null
        }
      });
      if (claimed.count !== 1) return { outcome: "CONFLICT" as const };
      const updated = await tx.listing.findUniqueOrThrow({ where: { id: current.id } });
      await writeAdminAction(tx, {
        adminId: req.user!.id,
        requestId: String(res.locals.requestId ?? ""),
        action: `LISTING_${parsed.data.status}`,
        entityType: "Listing",
        entityId: updated.id,
        reason: parsed.data.rejectionReason?.trim(),
        before: { status: current.status, rejectionReason: current.rejectionReason },
        after: { status: updated.status, rejectionReason: updated.rejectionReason }
      });
      await tx.notification.create({
        data: { userId: updated.sellerId, type: `LISTING_${parsed.data.status}`, payload: JSON.stringify({ listingId: updated.id, reason: updated.rejectionReason }) }
      });
      return { outcome: "UPDATED" as const, listing: updated };
    });
  } catch (error) {
    if (isAdminInventoryDatabaseConflict(error)) {
      return res.status(409).json({ message: "Listing inventory changed while this request was being processed" });
    }
    throw error;
  }
  if (result.outcome === "NOT_FOUND") return res.status(404).json({ message: "Listing not found" });
  if (result.outcome === "INVALID_TRANSITION") return res.status(409).json({ message: "This listing status transition is not allowed" });
  if (result.outcome === "INVENTORY_CONFLICT") return res.status(409).json({ message: result.message });
  if (result.outcome === "CONFLICT") return res.status(409).json({ message: "The listing changed during review. Reload it before moderating." });
  res.json({ listing: result.listing });
});

router.get("/reports", async (_req, res) => {
  const reports = await prisma.report.findMany({
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      listing: { include: { seller: { select: { id: true, name: true, email: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({
    reports: reports.map((report) => {
      const { listingSnapshot, listing, ...safeReport } = report;
      const { seller, ...currentListing } = listing;
      return {
        ...safeReport,
        listing: {
          ...presentHistoricalListing(currentListing, listingSnapshot),
          seller
        }
      };
    })
  });
});

router.patch("/reports/:id", async (req, res) => {
  const parsed = z.object({ status: z.nativeEnum(ReportStatus) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid report status" });
  const current = await prisma.report.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
  if (!current) return res.status(404).json({ message: "Report not found" });
  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.report.update({ where: { id: current.id }, data: { status: parsed.data.status } });
    await writeAdminAction(tx, {
      adminId: req.user!.id,
      requestId: String(res.locals.requestId ?? ""),
      action: `REPORT_${parsed.data.status}`,
      entityType: "Report",
      entityId: updated.id,
      before: { status: current.status },
      after: { status: updated.status }
    });
    return updated;
  });

  const { listingSnapshot: _snapshot, ...safeReport } = report;
  res.json({ report: safeReport });
});

router.patch("/users/:id/block", async (req, res) => {
  const parsed = z.object({ isBlocked: z.boolean(), reason: z.string().trim().max(500).optional() })
    .refine((value) => !value.isBlocked || Boolean(value.reason && value.reason.length >= 3), { message: "A block reason is required" })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid user status" });
  const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, isBlocked: true, role: true } });
  if (!current) return res.status(404).json({ message: "User not found" });
  const blockRule = canChangeUserBlock(req.user!.id, current, parsed.data.isBlocked);
  if (!blockRule.allowed) {
    if (blockRule.reason === "SELF_BLOCK") return res.status(400).json({ message: "Administrators cannot block their own account" });
    if (blockRule.reason === "ADMIN_TARGET") return res.status(403).json({ message: "Administrator accounts cannot be blocked here" });
    return res.status(409).json({ message: "User already has this block status" });
  }
  const user = await prisma.$transaction(async (tx) => {
    await lockMessageAccounts(tx, current.id);
    const updated = await tx.user.update({
      where: { id: current.id },
      data: {
        isBlocked: parsed.data.isBlocked,
        tokenVersion: parsed.data.isBlocked ? { increment: 1 } : undefined
      }
    });
    await writeAdminAction(tx, {
      adminId: req.user!.id,
      requestId: String(res.locals.requestId ?? ""),
      action: parsed.data.isBlocked ? "USER_BLOCK" : "USER_UNBLOCK",
      entityType: "User",
      entityId: updated.id,
      reason: parsed.data.reason,
      before: { isBlocked: current.isBlocked },
      after: { isBlocked: updated.isBlocked }
    });
    return updated;
  });

  res.json({ user: { ...user, passwordHash: undefined } });
});

router.get("/logs", async (req, res) => {
  const parsed = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    action: z.string().trim().max(100).optional(),
    entityType: z.string().trim().max(100).optional()
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid audit log filters" });
  const { page, limit, action, entityType } = parsed.data;
  const where = { action: action ? { contains: action, mode: "insensitive" as const } : undefined, entityType: entityType || undefined };
  const [logs, total] = await prisma.$transaction([
    prisma.adminActionLog.findMany({
      where,
      include: { admin: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.adminActionLog.count({ where })
  ]);
  res.json({ logs, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isVerified: true,
      isBlocked: true,
      faculty: true,
      campusArea: true,
      sellerType: true,
      createdAt: true,
      _count: { select: { reviewsReceived: true, listings: true } },
      reviewsReceived: { select: { rating: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ users });
});

router.get("/transactions", async (_req, res) => {
  const transactions = await prisma.transaction.findMany({
    include: {
      listing: { select: historicalListingSelect },
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ transactions: transactions.map(presentAdminTransaction) });
});

router.get("/reviews", async (_req, res) => {
  const reviews = await prisma.review.findMany({
    include: {
      reviewer: { select: { id: true, name: true, email: true } },
      reviewee: { select: { id: true, name: true, email: true, isBlocked: true } },
      transaction: { include: { listing: { select: historicalListingSelect } } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json({
    reviews: reviews.map((review) => ({
      ...review,
      transaction: presentAdminTransaction(review.transaction)
    }))
  });
});

router.get("/announcements", async (_req, res) => {
  const announcements = await prisma.announcement.findMany({
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ announcements });
});

router.patch("/announcements/:id/status", async (req, res) => {
  const parsed = z.object({ status: z.nativeEnum(AnnouncementStatus), rejectionReason: z.string().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid announcement status" });
  if (parsed.data.status === AnnouncementStatus.REJECTED && !parsed.data.rejectionReason?.trim()) {
    return res.status(400).json({ message: "A rejection reason is required" });
  }
  const current = await prisma.announcement.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true, status: true, rejectionReason: true, imageUrl: true } });
  if (!current) return res.status(404).json({ message: "Announcement not found" });
  const announcement = await prisma.$transaction(async (tx) => {
    const updated = await tx.announcement.update({
      where: { id: current.id },
      data: {
        status: parsed.data.status,
        rejectionReason: parsed.data.status === AnnouncementStatus.REJECTED ? parsed.data.rejectionReason?.trim() : null,
        imageUrl: parsed.data.status === AnnouncementStatus.REJECTED ? null : undefined
      }
    });
    await writeAdminAction(tx, {
      adminId: req.user!.id,
      requestId: String(res.locals.requestId ?? ""),
      action: `ANNOUNCEMENT_${parsed.data.status}`,
      entityType: "Announcement",
      entityId: updated.id,
      reason: parsed.data.rejectionReason?.trim(),
      before: { status: current.status, rejectionReason: current.rejectionReason },
      after: { status: updated.status, rejectionReason: updated.rejectionReason },
      metadata: { posterDetached: Boolean(current.imageUrl && parsed.data.status === AnnouncementStatus.REJECTED) }
    });
    await tx.notification.create({
      data: { userId: updated.authorId, type: `ANNOUNCEMENT_${parsed.data.status}`, payload: JSON.stringify({ announcementId: updated.id, reason: updated.rejectionReason }) }
    });
    return updated;
  });
  res.json({ announcement });
});
router.get("/disputes", async (_req, res) => {
  const disputes = await prisma.transaction.findMany({
    where: { status: "DISPUTED" },
    include: {
      listing: { select: historicalListingSelect },
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ disputes: disputes.map(presentAdminTransaction) });
});

router.patch("/disputes/:id/resolve", async (req, res) => {
  const parsed = z.object({
    verdict: z.enum(["COMPLETED", "CANCELLED"]),
    reason: z.string().trim().min(3).max(500)
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid verdict. Must be COMPLETED or CANCELLED." });
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: req.params.id, status: "DISPUTED" },
    include: { listing: true }
  });

  if (!transaction) {
    return res.status(404).json({ message: "Disputed transaction not found" });
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      await lockListingInventory(tx, transaction.listingId);
      const reservedListingType = parsed.data.verdict === "COMPLETED"
        ? transactionListingType(transaction.listingSnapshot, transaction.listingId)
        : null;
      if (parsed.data.verdict === "COMPLETED" && reservedListingType === null) {
        throw new AdminMutationError(
          409,
          "Reservation inventory evidence is incomplete. Resolve the snapshot before completing this dispute."
        );
      }
      const claimed = await tx.transaction.updateMany({
        where: { id: transaction.id, status: "DISPUTED" },
        data: {
          status: parsed.data.verdict === "COMPLETED" ? "COMPLETED" : "CANCELLED",
          completedAt: parsed.data.verdict === "COMPLETED" ? new Date() : undefined,
          cancelledAt: parsed.data.verdict === "CANCELLED" ? new Date() : undefined
        }
      });
      if (claimed.count !== 1) return null;

      if (parsed.data.verdict === "COMPLETED" && reservedListingType === ListingType.PRODUCT) {
        const settled = await settleProductInventory(tx, transaction.listingId, transaction.quantity);
        if (!settled) throw new AdminMutationError(409, "Listing stock changed. Review the dispute before trying again.");
      }

      const resolved = await tx.transaction.findUniqueOrThrow({
        where: { id: transaction.id },
        include: { listing: { select: historicalListingSelect } }
      });
      await writeAdminAction(tx, {
        adminId: req.user!.id,
        requestId: String(res.locals.requestId ?? ""),
        action: `DISPUTE_RESOLVE_${parsed.data.verdict}`,
        entityType: "Transaction",
        entityId: transaction.id,
        reason: parsed.data.reason,
        before: { status: transaction.status },
        after: { status: resolved.status }
      });
      const payload = JSON.stringify({ transactionId: transaction.id, verdict: parsed.data.verdict, reason: parsed.data.reason });
      await Promise.all([
        tx.notification.create({ data: { userId: transaction.buyerId, type: "DISPUTE_RESOLVED", payload } }),
        tx.notification.create({ data: { userId: transaction.sellerId, type: "DISPUTE_RESOLVED", payload } })
      ]);
      return resolved;
    });
  } catch (error) {
    if (error instanceof AdminMutationError) return res.status(error.status).json({ message: error.message });
    if (isAdminInventoryDatabaseConflict(error)) {
      return res.status(409).json({ message: "Listing inventory changed while this dispute was being resolved" });
    }
    throw error;
  }
  if (!updated) return res.status(409).json({ message: "This dispute has already been resolved" });

  res.json({ transaction: presentAdminTransaction(updated) });
});

export default router;
