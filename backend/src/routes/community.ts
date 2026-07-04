import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const router = Router();

router.get("/meetup-points", async (_req, res) => {
  const meetupPoints = await prisma.meetupPoint.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  res.json({ meetupPoints });
});

router.get("/notifications", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json({ notifications });
});

router.patch("/notifications/read", requireAuth, async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).send();
});

router.get("/blocks", requireAuth, async (req, res) => {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: req.user!.id },
    include: { blocked: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ blocks });
});

router.post("/blocks/:userId", requireAuth, async (req, res) => {
  const parsed = z.string().uuid().safeParse(req.params.userId);
  if (!parsed.success || parsed.data === req.user!.id) return res.status(400).json({ message: "Invalid user" });
  const block = await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId: parsed.data } },
    update: {},
    create: { blockerId: req.user!.id, blockedId: parsed.data }
  });
  res.status(201).json({ block });
});

router.delete("/blocks/:userId", requireAuth, async (req, res) => {
  await prisma.userBlock.deleteMany({ where: { blockerId: req.user!.id, blockedId: req.params.userId } });
  res.status(204).send();
});

export default router;
