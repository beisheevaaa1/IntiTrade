import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { lockMessageParticipants } from "../utils/messageLocks.js";

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
  const body = z.object({ reason: z.string().trim().min(3).max(300) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Please provide a reason for blocking this user" });
  const blockedUser = await prisma.user.findUnique({ where: { id: parsed.data }, select: { id: true } });
  if (!blockedUser) return res.status(404).json({ message: "User not found" });
  let block;
  try {
    block = await prisma.$transaction(async (tx) => {
      await lockMessageParticipants(tx, req.user!.id, parsed.data);
      return tx.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId: parsed.data } },
        update: { reason: body.data.reason },
        create: { blockerId: req.user!.id, blockedId: parsed.data, reason: body.data.reason }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return res.status(404).json({ message: "User not found" });
    }
    throw error;
  }
  res.status(201).json({ block });
});

router.delete("/blocks/:userId", requireAuth, async (req, res) => {
  await prisma.$transaction(async (tx) => {
    await lockMessageParticipants(tx, req.user!.id, req.params.userId);
    await tx.userBlock.deleteMany({ where: { blockerId: req.user!.id, blockedId: req.params.userId } });
  });
  res.status(204).send();
});

export default router;
