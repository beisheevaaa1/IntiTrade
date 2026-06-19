import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const parsed = z.object({
    listingId: z.string().uuid(),
    reason: z.string().min(3).max(120),
    details: z.string().max(1000).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid report data", errors: parsed.error.flatten() });

  const report = await prisma.report.create({
    data: { ...parsed.data, reporterId: req.user!.id },
    include: { listing: true }
  });
  res.status(201).json({ report });
});

export default router;
