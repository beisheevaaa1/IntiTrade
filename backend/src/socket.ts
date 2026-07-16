import type { Server } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import { z } from "zod";
import { allowedClientOrigins, env } from "./env.js";
import { prisma } from "./prisma.js";
import { verifyAccessToken } from "./utils/auth.js";
import { handleAutoReply } from "./utils/autoReply.js";
import { recordSocketConnection, recordSocketMessage } from "./monitoring.js";
import { sessionTokenFromCookie } from "./utils/sessionCookie.js";
import { isOwnedUploadUrl } from "./utils/uploadOwnership.js";
import { lockConversationMessages, lockMessageParticipants } from "./utils/messageLocks.js";

let ioInstance: SocketServer | null = null;

export function createSocketEventLimiter(maxBuckets = 10_000) {
  const windows = new Map<string, { timestamps: number[]; windowMs: number }>();
  let nextSweepAt = 0;
  return (userId: string, event: string, max: number, windowMs: number) => {
    const now = Date.now();
    if (now >= nextSweepAt) {
      for (const [key, bucket] of windows) {
        const recent = bucket.timestamps.filter((timestamp) => now - timestamp < bucket.windowMs);
        if (recent.length) windows.set(key, { ...bucket, timestamps: recent });
        else windows.delete(key);
      }
      nextSweepAt = now + windowMs;
    }
    const requestedKey = `${event}:${userId}`;
    const key = windows.has(requestedKey) || windows.size < maxBuckets ? requestedKey : `${event}:__overflow__`;
    const recent = (windows.get(key)?.timestamps ?? []).filter((timestamp) => now - timestamp < windowMs);
    if (recent.length >= max) return false;
    recent.push(now);
    windows.set(key, { timestamps: recent, windowMs });
    return true;
  };
}

const allowUserEvent = createSocketEventLimiter();

export function isAllowedSocketOrigin(origin?: string) {
  if (!origin) return env.NODE_ENV !== "production";
  return allowedClientOrigins.includes(origin);
}

const conversationIdSchema = z.string().uuid();
const attachmentSchema = z.string()
  .max(500)
  .regex(/^\/uploads\/[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif|mp4|mov|webm|ogg)$/i, "Invalid attachment URL");
const messageSchema = z.object({
  conversationId: conversationIdSchema,
  body: z.string().trim().max(1200).default(""),
  attachmentUrl: attachmentSchema.optional(),
  offerAmount: z.coerce.number().positive().max(1000000).optional()
}).refine((payload) => Boolean(payload.body || payload.attachmentUrl || payload.offerAmount), "Message content is required");
const typingSchema = z.object({ conversationId: conversationIdSchema });

type Ack = (response: { ok: boolean; message?: unknown }) => void;

async function socketAccountIsActive(socket: Socket) {
  const userId = socket.data.user?.id as string | undefined;
  const tokenVersion = socket.data.user?.tokenVersion as number | undefined;
  if (!userId || tokenVersion === undefined) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBlocked: true, tokenVersion: true } });
  const active = Boolean(user && !user.isBlocked && user.tokenVersion === tokenVersion);
  if (!active) socket.disconnect(true);
  return active;
}

export function attachSocket(server: Server) {
  const io = new SocketServer(server, {
    cors: { origin: allowedClientOrigins, credentials: true },
    allowRequest: (request, callback) => callback(null, isAllowedSocketOrigin(request.headers.origin)),
    maxHttpBufferSize: 20_000
  });
  ioInstance = io;

  io.use(async (socket, next) => {
    const token = typeof socket.handshake.auth.token === "string"
      ? socket.handshake.auth.token
      : sessionTokenFromCookie(socket.request.headers.cookie);
    if (!token || typeof token !== "string") return next(new Error("Authentication required"));
    try {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, role: true, isBlocked: true, tokenVersion: true }
      });
      if (!user || user.isBlocked || payload.tokenVersion !== user.tokenVersion) return next(new Error("Account is unavailable"));
      socket.data.user = { id: user.id, role: user.role, tokenVersion: user.tokenVersion };
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    recordSocketConnection(1);
    socket.once("disconnect", () => recordSocketConnection(-1));

    socket.join(`user:${socket.data.user.id}`);

    socket.on("conversation:join", async (input: unknown, callback?: Ack) => {
      try {
        const parsed = conversationIdSchema.safeParse(input);
        if (!parsed.success || !await socketAccountIsActive(socket)) return callback?.({ ok: false, message: "Invalid conversation" });
        const userId = socket.data.user.id as string;
        const conversation = await prisma.conversation.findFirst({
          where: { id: parsed.data, OR: [{ buyerId: userId }, { sellerId: userId }] }
        });
        if (!conversation) return callback?.({ ok: false, message: "Conversation not found" });

        socket.join(conversation.id);
        const readAt = new Date();
        await prisma.message.updateMany({
          where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
          data: { readAt, deliveredAt: readAt }
        });
        socket.to(conversation.id).emit("messages:read", { conversationId: conversation.id, readAt });
        callback?.({ ok: true });
      } catch (error) {
        console.error(JSON.stringify({ level: "error", event: "socket_join_failed", errorType: error instanceof Error ? error.name : "UnknownError" }));
        callback?.({ ok: false, message: "Could not open the conversation" });
      }
    });

    socket.on("message:send", async (input: unknown, callback?: Ack) => {
      try {
        const userId = socket.data.user.id as string;
        if (!allowUserEvent(userId, "message:send", 12, 10_000)) return callback?.({ ok: false, message: "You are sending messages too quickly" });
        const parsed = messageSchema.safeParse(input);
        if (!parsed.success || !await socketAccountIsActive(socket)) return callback?.({ ok: false, message: "Message rejected" });

        if (parsed.data.attachmentUrl && !isOwnedUploadUrl(userId, parsed.data.attachmentUrl)) {
          return callback?.({ ok: false, message: "Attachment rejected" });
        }
        const conversation = await prisma.conversation.findFirst({
          where: { id: parsed.data.conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] }
        });
        if (!conversation) return callback?.({ ok: false, message: "Conversation not found" });
        if (parsed.data.offerAmount && conversation.buyerId !== userId) {
          return callback?.({ ok: false, message: "Only the buyer can make an offer" });
        }

        const otherUserId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
        const connectedSockets = Array.from(io.sockets.sockets.values());
        const isPartnerOnline = connectedSockets.some((connected) => connected.data.user?.id === otherUserId);
        const roomSocketIds = io.sockets.adapter.rooms.get(conversation.id) ?? new Set<string>();
        const isPartnerInRoom = Array.from(roomSocketIds).some((socketId) => io.sockets.sockets.get(socketId)?.data.user?.id === otherUserId);
        const now = new Date();

        const message = await prisma.$transaction(async (tx) => {
          await lockMessageParticipants(tx, userId, otherUserId);
          await lockConversationMessages(tx, conversation.id);
          const blocked = await tx.userBlock.findFirst({
            where: { OR: [{ blockerId: userId, blockedId: otherUserId }, { blockerId: otherUserId, blockedId: userId }] },
            select: { id: true }
          });
          if (blocked) return null;

          const created = await tx.message.create({
            data: {
              conversationId: conversation.id,
              senderId: userId,
              body: parsed.data.body,
              attachmentUrl: parsed.data.attachmentUrl,
              offerAmount: parsed.data.offerAmount,
              offerStatus: parsed.data.offerAmount ? "PENDING" : undefined,
              deliveredAt: isPartnerOnline ? now : undefined,
              readAt: isPartnerInRoom ? now : undefined
            },
            include: { sender: { select: { id: true, name: true } } }
          });
          await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: now } });
          return created;
        });
        if (!message) return callback?.({ ok: false, message: "Messaging is unavailable" });

        io.to(conversation.id).emit("message:new", message);
        io.to(`user:${otherUserId}`).emit("conversation:updated", { conversationId: conversation.id, message });
        callback?.({ ok: true, message });
        recordSocketMessage(true);
        void handleAutoReply(conversation.id, userId);
      } catch (error) {
        console.error(JSON.stringify({ level: "error", event: "socket_message_failed", errorType: error instanceof Error ? error.name : "UnknownError" }));
        recordSocketMessage(false);
        callback?.({ ok: false, message: "Could not send the message" });
      }
    });

    const handleTyping = async (input: unknown, isTyping: boolean) => {
      try {
        const userId = socket.data.user.id as string;
        if (!allowUserEvent(userId, "typing", 10, 5_000)) return;
        const parsed = typingSchema.safeParse(input);
        if (!parsed.success) return;
        const conversation = await prisma.conversation.findFirst({
          where: { id: parsed.data.conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] },
          select: { id: true }
        });
        if (!conversation) return;
        socket.to(conversation.id).emit("typing:status", { conversationId: conversation.id, userId, isTyping });
      } catch (error) {
        console.error(JSON.stringify({ level: "error", event: "socket_typing_failed", errorType: error instanceof Error ? error.name : "UnknownError" }));
      }
    };

    socket.on("typing:start", (input: unknown) => void handleTyping(input, true));
    socket.on("typing:stop", (input: unknown) => void handleTyping(input, false));
  });

  return io;
}

export function getIo() {
  return ioInstance;
}
