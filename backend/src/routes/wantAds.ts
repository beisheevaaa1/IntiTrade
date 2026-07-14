import { Prisma, Role, WantAdStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { prisma } from "../prisma.js";

const router = Router();

const createLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  key: (req) => req.user?.id ?? req.ip ?? "unknown",
  message: "Want ad limit reached. Please try again later."
});

const wantAdSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(1500),
  maxPrice: z.coerce.number().positive().max(1000000),
  categoryId: z.string().uuid()
});

router.get("/", optionalAuth, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const mine = req.query.mine === "true" && req.user;
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const where: Prisma.WantAdWhereInput = {
    userId: mine ? req.user!.id : undefined,
    status: mine ? undefined : WantAdStatus.ACTIVE,
    category: category ? { slug: category } : undefined,
    OR: q ? [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] : undefined
  };

  const [wantAds, total] = await Promise.all([
    prisma.wantAd.findMany({
      where,
      include: { user: { select: { id: true, name: true, avatarUrl: true } }, category: true },
      orderBy: req.query.sort === "budget" ? { maxPrice: "desc" } : { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.wantAd.count({ where })
  ]);
  res.json({ wantAds, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

router.post("/", requireAuth, createLimit, async (req, res) => {
  const parsed = wantAdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId }, select: { id: true } });
  if (!category) return res.status(400).json({ message: "Category not found" });
  const wantAd = await prisma.wantAd.create({
    data: { ...parsed.data, userId: req.user!.id },
    include: { user: { select: { id: true, name: true, avatarUrl: true } }, category: true }
  });
  res.status(201).json({ wantAd });
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const status = z.nativeEnum(WantAdStatus).safeParse(req.body?.status);
  if (!id.success || !status.success) return res.status(400).json({ message: "Invalid request or status" });
  const wantAd = await prisma.wantAd.findUnique({ where: { id: id.data } });
  if (!wantAd) return res.status(404).json({ message: "Request not found" });
  if (wantAd.userId !== req.user!.id && req.user!.role !== Role.ADMIN) return res.status(403).json({ message: "Not allowed" });
  const updated = await prisma.wantAd.update({ where: { id: wantAd.id }, data: { status: status.data } });
  res.json({ wantAd: updated });
});

export default router;
