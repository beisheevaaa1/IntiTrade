import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { handleAutoReply } from "../utils/autoReply.js";
import { ListingStatus, Prisma, TransactionStatus } from "@prisma/client";
import { createRateLimit } from "../middleware/rateLimit.js";
import { isOwnedUploadUrl } from "../utils/uploadOwnership.js";
import { getIo } from "../socket.js";

const router = Router();

const messageRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 60,
  key: (req) => `${req.user?.id ?? req.ip}:messages`,
  message: "You are sending messages too quickly"
});

const attachmentUrlSchema = z.string()
  .max(500)
  .regex(/^\/uploads\/[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif|mp4|mov|webm|ogg)$/i);

const conversationInclude = {
  listing: {
    include: {
      images: true,
      meetupPoint: true
    }
  },
  buyer: { select: { id: true, name: true, avatarUrl: true, lastActiveAt: true, showOnlineStatus: true } },
  seller: { select: { id: true, name: true, avatarUrl: true, lastActiveAt: true, showOnlineStatus: true } },
  messages: {
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const }
  }
};

const reservationSelect = Prisma.validator<Prisma.TransactionSelect>()({
  id: true,
  listingId: true,
  buyerId: true,
  sellerId: true,
  price: true,
  quantity: true,
  status: true,
  meetupPointId: true,
  otpCode: true,
  createdAt: true
});

type Reservation = Prisma.TransactionGetPayload<{ select: typeof reservationSelect }>;

function reservationKey(listingId: string, buyerId: string, sellerId: string) {
  return `${listingId}:${buyerId}:${sellerId}`;
}

function presentReservation(transaction: Reservation, viewerId: string) {
  const { otpCode, ...safeTransaction } = transaction;
  return {
    ...safeTransaction,
    otpCode: transaction.buyerId === viewerId ? otpCode : undefined
  };
}

async function getReservations(conversations: Array<{ listingId: string; buyerId: string; sellerId: string }>) {
  if (!conversations.length) return new Map<string, Reservation>();
  const transactions = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.RESERVED,
      listingId: { in: Array.from(new Set(conversations.map((conversation) => conversation.listingId))) }
    },
    select: reservationSelect,
    orderBy: { createdAt: "desc" }
  });
  return new Map(
    transactions.map((transaction) => [reservationKey(transaction.listingId, transaction.buyerId, transaction.sellerId), transaction])
  );
}

function attachReservation<Conversation extends { listing: object; listingId: string; buyerId: string; sellerId: string }>(
  conversation: Conversation,
  reservations: Map<string, Reservation>,
  viewerId: string
) {
  const transaction = reservations.get(reservationKey(conversation.listingId, conversation.buyerId, conversation.sellerId));
  return {
    ...conversation,
    listing: {
      ...conversation.listing,
      transactions: transaction ? [presentReservation(transaction, viewerId)] : []
    }
  };
}

router.get("/", requireAuth, async (req, res) => {
  const myUserId = req.user!.id;
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: myUserId }, { sellerId: myUserId }]
    },
    include: conversationInclude,
    orderBy: { updatedAt: "desc" }
  });

  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: myUserId }, { blockedId: myUserId }] }
  });

  const blockerIds = new Set(blocks.filter(b => b.blockerId === myUserId).map(b => b.blockedId));
  const blockedByUiIds = new Set(blocks.filter(b => b.blockedId === myUserId).map(b => b.blockerId));
  const reservations = await getReservations(conversations);

  const conversationsWithBlockInfo = conversations.map((conv) => {
    const partnerId = conv.buyerId === myUserId ? conv.sellerId : conv.buyerId;
    return {
      ...attachReservation(conv, reservations, myUserId),
      isBlockedByMe: blockerIds.has(partnerId),
      hasBlockedMe: blockedByUiIds.has(partnerId)
    };
  });

  res.json({ conversations: conversationsWithBlockInfo });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = z.object({ listingId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Listing id is required" });

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId }, include: { seller: { select: { allowMessages: true } } } });
  if (!listing || listing.status !== ListingStatus.ACTIVE) return res.status(404).json({ message: "Listing not found" });
  if (listing.sellerId === req.user!.id) return res.status(400).json({ message: "You cannot start a conversation with yourself" });
  if (!listing.seller.allowMessages) return res.status(403).json({ message: "This seller is not accepting new messages" });

  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: req.user!.id, blockedId: listing.sellerId },
        { blockerId: listing.sellerId, blockedId: req.user!.id }
      ]
    }
  });
  if (blocks.length) return res.status(403).json({ message: "Messaging is unavailable between these accounts" });

  const existingConv = await prisma.conversation.findUnique({
    where: { listingId_buyerId_sellerId: { listingId: listing.id, buyerId: req.user!.id, sellerId: listing.sellerId } }
  });

  if (!existingConv) {
    void prisma.listing.update({
      where: { id: listing.id },
      data: { interestCount: { increment: 1 } }
    }).catch(() => undefined);
  }

  const conversation = await prisma.conversation.upsert({
    where: { listingId_buyerId_sellerId: { listingId: listing.id, buyerId: req.user!.id, sellerId: listing.sellerId } },
    update: {},
    create: { listingId: listing.id, buyerId: req.user!.id, sellerId: listing.sellerId },
    include: conversationInclude
  });
  const reservations = await getReservations([conversation]);

  res.status(201).json({
    conversation: {
      ...attachReservation(conversation, reservations, req.user!.id),
      isBlockedByMe: false,
      hasBlockedMe: false
    }
  });
});

router.get("/:id", requireAuth, async (req, res) => {
  const myUserId = req.user!.id;
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, OR: [{ buyerId: myUserId }, { sellerId: myUserId }] },
    include: conversationInclude
  });
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });
  const reservations = await getReservations([conversation]);

  const partnerId = conversation.buyerId === myUserId ? conversation.sellerId : conversation.buyerId;
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: myUserId, blockedId: partnerId },
        { blockerId: partnerId, blockedId: myUserId }
      ]
    }
  });

  const isBlockedByMe = blocks.some(b => b.blockerId === myUserId && b.blockedId === partnerId);
  const hasBlockedMe = blocks.some(b => b.blockerId === partnerId && b.blockedId === myUserId);

  res.json({
    conversation: {
      ...attachReservation(conversation, reservations, myUserId),
      isBlockedByMe,
      hasBlockedMe
    }
  });
});

router.post("/:id/messages", requireAuth, messageRateLimit, async (req, res) => {
  const parsed = z.object({
    body: z.string().trim().max(1200).default(""),
    attachmentUrl: attachmentUrlSchema.optional(),
    offerAmount: z.coerce.number().positive().max(1000000).optional()
  }).refine((data) => Boolean(data.body || data.attachmentUrl || data.offerAmount), "Message content is required").safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Message content is required" });
  if (parsed.data.attachmentUrl && !isOwnedUploadUrl(req.user!.id, parsed.data.attachmentUrl)) {
    return res.status(403).json({ message: "You can only attach media uploaded by your account" });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] }
  });
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });
  if (parsed.data.offerAmount && conversation.buyerId !== req.user!.id) {
    return res.status(403).json({ message: "Only the buyer can make an offer" });
  }
  const otherUserId = conversation.buyerId === req.user!.id ? conversation.sellerId : conversation.buyerId;
  const blocked = await prisma.userBlock.findFirst({
    where: { OR: [{ blockerId: req.user!.id, blockedId: otherUserId }, { blockerId: otherUserId, blockedId: req.user!.id }] }
  });
  if (blocked) return res.status(403).json({ message: "Messaging is unavailable between these accounts" });

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: req.user!.id,
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl,
      offerAmount: parsed.data.offerAmount,
      offerStatus: parsed.data.offerAmount ? "PENDING" : undefined
    },
    include: { sender: { select: { id: true, name: true } } }
  });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  const io = getIo();
  io?.to(conversation.id).emit("message:new", message);
  io?.to(`user:${otherUserId}`).emit("conversation:updated", { conversationId: conversation.id, message });

  res.status(201).json({ message });

  // Trigger auto-reply helper in background
  handleAutoReply(conversation.id, req.user!.id);
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] }
  });
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });
  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: req.user!.id }, readAt: null },
    data: { readAt: new Date() }
  });
  res.status(204).send();
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
  if (!listing || listing.status !== ListingStatus.ACTIVE) return res.status(404).json({ message: "Listing not found" });

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
  const reservations = await getReservations([updatedConv]);

  res.json({ conversation: attachReservation(updatedConv, reservations, req.user!.id) });
});

export default router;
