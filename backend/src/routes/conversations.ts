import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { handleAutoReply } from "../utils/autoReply.js";

const router = Router();

const conversationInclude = {
  listing: { include: { images: true } },
  buyer: { select: { id: true, name: true, avatarUrl: true, lastActiveAt: true, showOnlineStatus: true } },
  seller: { select: { id: true, name: true, avatarUrl: true, lastActiveAt: true, showOnlineStatus: true } },
  messages: {
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const }
  }
};

router.get("/", requireAuth, async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] },
    include: conversationInclude,
    orderBy: { updatedAt: "desc" }
  });
  res.json({ conversations });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = z.object({ listingId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Listing id is required" });

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  if (listing.sellerId === req.user!.id) return res.status(400).json({ message: "You cannot start a conversation with yourself" });

  const conversation = await prisma.conversation.upsert({
    where: { listingId_buyerId_sellerId: { listingId: listing.id, buyerId: req.user!.id, sellerId: listing.sellerId } },
    update: {},
    create: { listingId: listing.id, buyerId: req.user!.id, sellerId: listing.sellerId },
    include: conversationInclude
  });

  res.status(201).json({ conversation });
});

router.get("/:id", requireAuth, async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] },
    include: conversationInclude
  });
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });
  res.json({ conversation });
});

router.post("/:id/messages", requireAuth, async (req, res) => {
  const parsed = z.object({ body: z.string().min(1).max(1200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Message body is required" });

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] }
  });
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: req.user!.id, body: parsed.data.body },
    include: { sender: { select: { id: true, name: true } } }
  });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  res.status(201).json({ message });

  // Trigger auto-reply helper in background
  handleAutoReply(conversation.id, req.user!.id);
});

// Endpoint to change the attached active listing for a conversation
router.patch("/:id/listing", requireAuth, async (req, res) => {
  const parsed = z.object({ listingId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Valid Listing ID is required" });

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] }
  });
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });

  // Verify that the listing actually exists
  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId }
  });
  if (!listing) return res.status(404).json({ message: "Listing not found" });

  // Verify that the listing belongs to the seller of this conversation
  if (listing.sellerId !== conversation.sellerId) {
    return res.status(400).json({ message: "This listing does not belong to the seller of this conversation" });
  }

  // Update the conversation's active listing
  const updatedConv = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { listingId: listing.id },
    include: conversationInclude
  });

  res.json({ conversation: updatedConv });
});

export default router;
