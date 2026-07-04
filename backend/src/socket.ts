import type { Server } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { verifyAccessToken } from "./utils/auth.js";
import { handleAutoReply } from "./utils/autoReply.js";

let ioInstance: SocketServer | null = null;

export function attachSocket(server: Server) {
  const io = new SocketServer(server, {
    cors: { origin: env.CLIENT_URL, credentials: true }
  });
  ioInstance = io;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token || typeof token !== "string") return next(new Error("Authentication required"));
    try {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, role: true, isBlocked: true } });
      if (!user || user.isBlocked) return next(new Error("Account is unavailable"));
      socket.data.user = { id: user.id, role: user.role };
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("conversation:join", async (conversationId: string) => {
      const userId = socket.data.user.id as string;
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] }
      });
      if (conversation) {
        socket.join(conversationId);
        await prisma.message.updateMany({
          where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
          data: { readAt: new Date(), deliveredAt: new Date() }
        });
        socket.to(conversation.id).emit("messages:read", { conversationId: conversation.id, readAt: new Date() });
      }
    });

    socket.on("message:send", async (payload: { conversationId: string; body?: string; attachmentUrl?: string; offerAmount?: number }, callback?: (response: unknown) => void) => {
      const userId = socket.data.user.id as string;
      const conversation = await prisma.conversation.findFirst({
        where: { id: payload.conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] }
      });
      const body = payload.body?.trim() ?? "";
      if (!conversation || body.length > 1200 || (!body && !payload.attachmentUrl && !payload.offerAmount)) {
        callback?.({ ok: false, message: "Message rejected" });
        return;
      }
      const otherUserId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
      const blocked = await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: userId, blockedId: otherUserId }, { blockerId: otherUserId, blockedId: userId }] } });
      if (blocked) return callback?.({ ok: false, message: "Messaging is unavailable" });

      const allSockets = await io.fetchSockets();
      const isPartnerOnline = allSockets.some(s => s.data.user?.id === otherUserId);
      const roomSockets = await io.in(conversation.id).fetchSockets();
      const isPartnerInRoom = roomSockets.some(s => s.data.user?.id === otherUserId);

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          body,
          attachmentUrl: payload.attachmentUrl?.slice(0, 500),
          offerAmount: payload.offerAmount && payload.offerAmount > 0 ? payload.offerAmount : undefined,
          deliveredAt: isPartnerOnline ? new Date() : undefined,
          readAt: isPartnerInRoom ? new Date() : undefined
        },
        include: { sender: { select: { id: true, name: true } } }
      });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      
      io.to(conversation.id).emit("message:new", message);
      callback?.({ ok: true, message });

      // Trigger auto-reply in background
      handleAutoReply(conversation.id, userId);
    });

    socket.on("typing:start", async (payload: { conversationId: string }) => {
      const userId = socket.data.user.id as string;
      const conversation = await prisma.conversation.findFirst({ where: { id: payload.conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] }, select: { id: true } });
      if (!conversation) return;
      socket.to(payload.conversationId).emit("typing:status", {
        conversationId: payload.conversationId,
        userId,
        isTyping: true
      });
    });

    socket.on("typing:stop", async (payload: { conversationId: string }) => {
      const userId = socket.data.user.id as string;
      const conversation = await prisma.conversation.findFirst({ where: { id: payload.conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] }, select: { id: true } });
      if (!conversation) return;
      socket.to(payload.conversationId).emit("typing:status", {
        conversationId: payload.conversationId,
        userId,
        isTyping: false
      });
    });
  });

  return io;
}

export function getIo() {
  return ioInstance;
}
