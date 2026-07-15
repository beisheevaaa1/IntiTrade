import { prisma } from "../prisma.js";
import { getIo } from "../socket.js";

// Keep track of active auto-reply timeouts to avoid duplicating if multiple messages arrive within the delay period
const activeTimeouts = new Map<string, NodeJS.Timeout>();

export async function handleAutoReply(conversationId: string, senderId: string) {
  try {
    // 1. Fetch conversation details to find the recipient
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        buyer: true,
        seller: true
      }
    });

    if (!conversation) return;

    // Recipient is the person who is NOT the sender of the current message
    const recipient = conversation.buyerId === senderId ? conversation.seller : conversation.buyer;
    
    if (!recipient.autoReplyEnabled) return;

    // Prevent auto-reply infinite loops or flooding
    // Find the last 2 messages in this conversation
    const recentMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 2
    });

    // If the last message before this was already an auto-reply or from this recipient, don't trigger it again
    const lastMsg = recentMessages[0];
    const prevMsg = recentMessages[1];

    if (prevMsg && prevMsg.senderId === recipient.id && lastMsg.senderId === senderId) {
      // If we just sent an auto-reply recently, wait at least 3 minutes before sending another one
      const timeDiff = Date.now() - new Date(prevMsg.createdAt).getTime();
      if (timeDiff < 3 * 60 * 1000) {
        return; 
      }
    }

    // Key to identify this conversation trigger
    const timeoutKey = `${conversationId}:${recipient.id}`;

    // If there is already a pending auto-reply for this user in this conversation, clear/reset it or ignore
    if (activeTimeouts.has(timeoutKey)) {
      return; // already queued
    }

    const delayMs = (recipient.autoReplyDelay || 0) * 1000;

    const timeout = setTimeout(async () => {
      activeTimeouts.delete(timeoutKey);
      
      try {
        // Double check if conversation still exists and the last message is still from the buyer
        const currentConv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        });

        if (!currentConv) return;
        
        // If the user has already replied manually in the meantime, cancel the auto-reply
        const lastMessage = currentConv.messages[0];
        if (lastMessage && lastMessage.senderId === recipient.id) {
          return;
        }

        // Create the auto-reply message
        const replyMsg = await prisma.message.create({
          data: {
            conversationId,
            senderId: recipient.id,
            body: recipient.autoReplyMessage || "Hi! I am currently away. I'll get back to you shortly."
          },
          include: {
            sender: {
              select: { id: true, name: true }
            }
          }
        });

        // Update conversation's updatedAt timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        // Send to WebSocket room
        const io = getIo();
        if (io) {
          io.to(conversationId).emit("message:new", replyMsg);
        }
      } catch (err) {
        console.error(JSON.stringify({ level: "error", event: "auto_reply_timeout_failed", errorType: err instanceof Error ? err.name : "UnknownError" }));
      }
    }, delayMs);

    activeTimeouts.set(timeoutKey, timeout);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "auto_reply_setup_failed", errorType: err instanceof Error ? err.name : "UnknownError" }));
  }
}
