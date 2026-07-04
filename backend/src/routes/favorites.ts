import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const favorites = await prisma.favorite.findMany({
    where: { userId: req.user!.id },
    include: {
      listing: {
        include: {
          seller: { select: { id: true, name: true, avatarUrl: true, sellerType: true } },
          category: true,
          images: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ favorites });
});

router.post("/:listingId", requireAuth, async (req, res) => {
  const favorite = await prisma.favorite.upsert({
    where: { userId_listingId: { userId: req.user!.id, listingId: req.params.listingId } },
    update: {},
    create: { userId: req.user!.id, listingId: req.params.listingId }
  });
  res.status(201).json({ favorite });
});

router.delete("/:listingId", requireAuth, async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user!.id, listingId: req.params.listingId } });
  res.status(204).send();
});

export default router;
