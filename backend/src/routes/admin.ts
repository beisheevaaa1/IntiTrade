import { AnnouncementStatus, ListingStatus, ReportStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/overview", async (_req, res) => {
  const [pendingListings, openReports, users, activeListings] = await Promise.all([
    prisma.listing.count({ where: { status: ListingStatus.PENDING } }),
    prisma.report.count({ where: { status: ReportStatus.OPEN } }),
    prisma.user.count(),
    prisma.listing.count({ where: { status: ListingStatus.ACTIVE } })
  ]);
  res.json({ pendingListings, openReports, users, activeListings });
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
  if (!parsed.success) return res.status(400).json({ message: "Invalid listing status" });
  
  const listing = await prisma.listing.update({ 
    where: { id: req.params.id }, 
    data: { 
      status: parsed.data.status,
      rejectionReason: parsed.data.status === ListingStatus.REJECTED ? parsed.data.rejectionReason : null
    } 
  });

  await prisma.adminActionLog.create({
    data: {
      adminId: req.user!.id,
      action: `LISTING_${parsed.data.status}`,
      entityType: "Listing",
      entityId: listing.id,
      reason: parsed.data.rejectionReason || null
    }
  });

  await prisma.notification.create({
    data: { userId: listing.sellerId, type: `LISTING_${parsed.data.status}`, payload: JSON.stringify({ listingId: listing.id, reason: parsed.data.rejectionReason }) }
  });
  res.json({ listing });
});

router.get("/reports", async (_req, res) => {
  const reports = await prisma.report.findMany({
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      listing: { include: { seller: { select: { id: true, name: true, email: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ reports });
});

router.patch("/reports/:id", async (req, res) => {
  const parsed = z.object({ status: z.nativeEnum(ReportStatus) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid report status" });
  const report = await prisma.report.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
  
  await prisma.adminActionLog.create({
    data: {
      adminId: req.user!.id,
      action: `REPORT_${parsed.data.status}`,
      entityType: "Report",
      entityId: report.id
    }
  });

  res.json({ report });
});

router.patch("/users/:id/block", async (req, res) => {
  const parsed = z.object({ isBlocked: z.boolean(), reason: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid user status" });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isBlocked: parsed.data.isBlocked } });
  
  await prisma.adminActionLog.create({
    data: {
      adminId: req.user!.id,
      action: parsed.data.isBlocked ? "USER_BLOCK" : "USER_UNBLOCK",
      entityType: "User",
      entityId: user.id,
      reason: parsed.data.reason || null
    }
  });

  res.json({ user: { ...user, passwordHash: undefined } });
});

router.get("/logs", async (_req, res) => {
  const logs = await prisma.adminActionLog.findMany({
    include: { admin: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ logs });
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
      listing: { select: { id: true, title: true, price: true } },
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ transactions });
});

router.get("/reviews", async (_req, res) => {
  const reviews = await prisma.review.findMany({
    include: {
      reviewer: { select: { id: true, name: true, email: true } },
      reviewee: { select: { id: true, name: true, email: true, isBlocked: true } },
      transaction: { include: { listing: { select: { id: true, title: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json({ reviews });
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
  const announcement = await prisma.announcement.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status, rejectionReason: parsed.data.status === AnnouncementStatus.REJECTED ? parsed.data.rejectionReason : null }
  });
  await prisma.adminActionLog.create({
    data: { adminId: req.user!.id, action: `ANNOUNCEMENT_${parsed.data.status}`, entityType: "Announcement", entityId: announcement.id, reason: parsed.data.rejectionReason }
  });
  await prisma.notification.create({
    data: { userId: announcement.authorId, type: `ANNOUNCEMENT_${parsed.data.status}`, payload: JSON.stringify({ announcementId: announcement.id, reason: parsed.data.rejectionReason }) }
  });
  res.json({ announcement });
});

export default router;
