import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ListingStatus } from "@prisma/client";
import { createApprovedListingSnapshot, listingSnapshotInclude, presentHistoricalListing } from "../utils/listingSnapshot.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const parsed = z.object({
    listingId: z.string().uuid(),
    reason: z.string().min(3).max(120),
    details: z.string().max(1000).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid report data", errors: parsed.error.flatten() });

  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    include: listingSnapshotInclude
  });
  if (!listing || listing.status !== ListingStatus.ACTIVE) {
    return res.status(404).json({ message: "Listing not found" });
  }

  const report = await prisma.report.create({
    data: {
      ...parsed.data,
      reporterId: req.user!.id,
      listingSnapshot: createApprovedListingSnapshot(listing)
    },
    include: { listing: true }
  });
  const { listingSnapshot, listing: currentListing, ...safeReport } = report;
  res.status(201).json({
    report: {
      ...safeReport,
      listing: presentHistoricalListing(currentListing, listingSnapshot)
    }
  });
});

export default router;
