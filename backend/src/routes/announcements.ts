import { AnnouncementStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { isOwnedImageUploadUrl } from "../utils/uploadOwnership.js";

const router = Router();

const announcementSchema = z.object({
  title: z.string().trim().min(4).max(120),
  body: z.string().trim().min(10).max(2000),
  imageUrl: z.string().max(500).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  eventDate: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional()
});

router.get("/", async (_req, res) => {
  const announcements = await prisma.announcement.findMany({
    where: {
      status: AnnouncementStatus.ACTIVE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    include: { author: { select: { id: true, name: true, avatarUrl: true, faculty: true } } },
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }]
  });
  res.json({ announcements });
});

router.get("/mine", requireAuth, async (req, res) => {
  const announcements = await prisma.announcement.findMany({ where: { authorId: req.user!.id }, orderBy: { createdAt: "desc" } });
  res.json({ announcements });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = announcementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid announcement", errors: parsed.error.flatten() });
  if (parsed.data.imageUrl && !isOwnedImageUploadUrl(req.user!.id, parsed.data.imageUrl)) {
    return res.status(403).json({ message: "An announcement can only use an image uploaded by its author" });
  }
  const announcement = await prisma.announcement.create({
    data: { ...parsed.data, authorId: req.user!.id, status: req.user!.role === Role.ADMIN ? AnnouncementStatus.ACTIVE : AnnouncementStatus.PENDING }
  });
  res.status(201).json({ announcement });
});

export default router;
