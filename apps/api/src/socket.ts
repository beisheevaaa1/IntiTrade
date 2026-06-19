import type { Server } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { verifyAccessToken } from "./utils/auth.js";

export function attachSocket(server: Server) {
  const io = new SocketServer(server, {
    cors: { origin: env.CLIENT_URL, credentials: true }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token || typeof token !== "string") return next(new Error("Authentication required"));
    try {
      socket.data.user = verifyAccessToken(token);
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
      if (conversation) socket.join(conversationId);
    });

    socket.on("message:send", async (payload: { conversationId: string; body: string }, callback?: (response: unknown) => void) => {
      const userId = socket.data.user.id as string;
      const conversation = await prisma.conversation.findFirst({
        where: { id: payload.conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] }
      });
      if (!conversation || !payload.body?.trim()) {
        callback?.({ ok: false, message: "Message rejected" });
        return;
      }

      const message = await prisma.message.create({
        data: { conversationId: conversation.id, senderId: userId, body: payload.body.trim() },
        include: { sender: { select: { id: true, name: true } } }
      });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      io.to(conversation.id).emit("message:new", message);
      callback?.({ ok: true, message });
    });
  });

  return io;
}
