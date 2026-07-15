import {
  Prisma,
  Role,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { prisma } from "../prisma.js";
import { writeAdminAction } from "../services/adminAudit.js";

const router = Router();

const createTicketLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  key: (req) => req.user?.id || req.ip || "unknown",
  message: "Too many support requests. Please wait before creating another ticket."
});

const messageLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  key: (req) => req.user?.id || req.ip || "unknown",
  message: "Too many support messages. Please wait before sending another message."
});

const adminUpdateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 60,
  key: (req) => req.user?.id || req.ip || "unknown"
});

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(5000),
  category: z.nativeEnum(SupportTicketCategory)
});

export const supportMessageSchema = z.object({
  body: z.string().trim().min(2).max(5000)
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const adminListSchema = paginationSchema.extend({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  q: z.string().trim().max(100).optional()
});

const adminUpdateSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  reply: z.string().trim().min(2).max(5000).optional()
}).refine((value) => Object.keys(value).length > 0, { message: "At least one change is required" });

const messagePaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

function pagination(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

const messageInclude = {
  author: { select: { id: true, name: true } }
} satisfies Prisma.SupportTicketMessageInclude;

const ticketListInclude = {
  assignedAdmin: { select: { id: true, name: true } },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: messageInclude
  },
  _count: { select: { messages: true } }
} satisfies Prisma.SupportTicketInclude;

router.use(requireAuth);

router.get("/admin", requireAdmin, async (req, res) => {
  const parsed = adminListSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid support ticket filters" });

  const { page, limit, status, priority, q } = parsed.data;
  const where: Prisma.SupportTicketWhereInput = {
    status,
    priority,
    ...(q ? {
      OR: [
        { subject: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } }
      ]
    } : {})
  };

  const [total, openCount, tickets] = await prisma.$transaction([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.count({
      where: { status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.WAITING_FOR_USER] } }
    }),
    prisma.supportTicket.findMany({
      where,
      include: {
        ...ticketListInclude,
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  res.json({ tickets, openCount, pagination: pagination(total, page, limit) });
});

router.get("/admin/:id/messages", requireAdmin, async (req, res) => {
  const parsed = messagePaginationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid message pagination" });
  const { page, limit } = parsed.data;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      assignedAdmin: { select: { id: true, name: true } }
    }
  });
  if (!ticket) return res.status(404).json({ message: "Support ticket not found" });

  const [total, messages] = await prisma.$transaction([
    prisma.supportTicketMessage.count({ where: { ticketId: ticket.id } }),
    prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id },
      include: messageInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  res.json({ ticket, messages: messages.reverse(), pagination: pagination(total, page, limit) });
});

router.patch("/admin/:id", requireAdmin, adminUpdateLimit, async (req, res) => {
  const parsed = adminUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid support ticket update", errors: parsed.error.flatten() });
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const existing = await tx.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!existing) return null;
    const remainsClosed = existing.status === SupportTicketStatus.CLOSED
      && (parsed.data.status === undefined || parsed.data.status === SupportTicketStatus.CLOSED);
    if (parsed.data.reply && remainsClosed) return { closed: true as const };

    const data: Prisma.SupportTicketUncheckedUpdateInput = { assignedAdminId: req.user!.id };
    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      data.resolvedAt = parsed.data.status === SupportTicketStatus.RESOLVED || parsed.data.status === SupportTicketStatus.CLOSED
        ? existing.resolvedAt || new Date()
        : null;
    }
    if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
    if (parsed.data.reply) data.lastMessageAt = new Date();

    const updated = await tx.supportTicket.update({
      where: { id: existing.id },
      data
    });

    if (parsed.data.reply) {
      await tx.supportTicketMessage.create({
        data: { ticketId: updated.id, authorId: req.user!.id, body: parsed.data.reply, isAdmin: true }
      });
    }

    const changedFields = [
      parsed.data.status !== undefined ? "status" : null,
      parsed.data.priority !== undefined ? "priority" : null,
      parsed.data.reply ? "reply" : null
    ].filter(Boolean);
    await writeAdminAction(tx, {
      adminId: req.user!.id,
      requestId: String(res.locals.requestId ?? ""),
      action: "SUPPORT_TICKET_UPDATE",
      entityType: "SupportTicket",
      entityId: updated.id,
      reason: `Changed fields: ${changedFields.join(", ")}`,
      before: { status: existing.status, priority: existing.priority, assignedAdminId: existing.assignedAdminId },
      after: { status: updated.status, priority: updated.priority, assignedAdminId: updated.assignedAdminId },
      metadata: { changedFields }
    });

    await tx.notification.create({
      data: {
        userId: updated.userId,
        type: "SUPPORT_TICKET_UPDATED",
        payload: JSON.stringify({ ticketId: updated.id, status: updated.status, hasNewReply: Boolean(parsed.data.reply) })
      }
    });

    return tx.supportTicket.findUniqueOrThrow({
      where: { id: updated.id },
      include: {
        ...ticketListInclude,
        user: { select: { id: true, name: true, email: true } }
      }
    });
  });

  if (!ticket) return res.status(404).json({ message: "Support ticket not found" });
  if ("closed" in ticket) return res.status(409).json({ message: "Reopen the ticket before sending a support reply" });
  res.json({ ticket });
});

router.get("/", async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid ticket pagination" });
  const { page, limit } = parsed.data;
  const where = { userId: req.user!.id };

  const [total, tickets] = await prisma.$transaction([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      include: ticketListInclude,
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  res.json({ tickets, pagination: pagination(total, page, limit) });
});

router.post("/", createTicketLimit, async (req, res) => {
  const parsed = supportTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid support request", errors: parsed.error.flatten() });
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: { ...parsed.data, userId: req.user!.id }
    });
    await tx.supportTicketMessage.create({
      data: { ticketId: created.id, authorId: req.user!.id, body: parsed.data.description, isAdmin: false }
    });
    const admins = await tx.user.findMany({ where: { role: Role.ADMIN, isBlocked: false }, select: { id: true } });
    if (admins.length > 0) {
      await tx.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "SUPPORT_TICKET_CREATED",
          payload: JSON.stringify({ ticketId: created.id })
        }))
      });
    }
    return tx.supportTicket.findUniqueOrThrow({ where: { id: created.id }, include: ticketListInclude });
  });

  res.status(201).json({ ticket });
});

router.get("/:id/messages", async (req, res) => {
  const parsed = messagePaginationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid message pagination" });
  const { page, limit } = parsed.data;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { assignedAdmin: { select: { id: true, name: true } } }
  });
  if (!ticket) return res.status(404).json({ message: "Support ticket not found" });

  const [total, messages] = await prisma.$transaction([
    prisma.supportTicketMessage.count({ where: { ticketId: ticket.id } }),
    prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id },
      include: messageInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  res.json({ ticket, messages: messages.reverse(), pagination: pagination(total, page, limit) });
});

router.post("/:id/messages", messageLimit, async (req, res) => {
  const parsed = supportMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid support message", errors: parsed.error.flatten() });

  const result = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });
    if (!ticket) return { outcome: "NOT_FOUND" as const };
    if (ticket.status === SupportTicketStatus.CLOSED) return { outcome: "CLOSED" as const };

    const created = await tx.supportTicketMessage.create({
      data: { ticketId: ticket.id, authorId: req.user!.id, body: parsed.data.body, isAdmin: false },
      include: messageInclude
    });
    const nextStatus = ticket.status === SupportTicketStatus.WAITING_FOR_USER || ticket.status === SupportTicketStatus.RESOLVED
      ? SupportTicketStatus.OPEN
      : ticket.status;
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { status: nextStatus, resolvedAt: null, lastMessageAt: created.createdAt }
    });

    const adminIds = ticket.assignedAdminId
      ? [ticket.assignedAdminId]
      : (await tx.user.findMany({ where: { role: Role.ADMIN, isBlocked: false }, select: { id: true } })).map((admin) => admin.id);
    if (adminIds.length > 0) {
      await tx.notification.createMany({
        data: adminIds.map((adminId) => ({
          userId: adminId,
          type: "SUPPORT_TICKET_MESSAGE",
          payload: JSON.stringify({ ticketId: ticket.id })
        }))
      });
    }
    return { outcome: "CREATED" as const, message: created };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (result.outcome === "NOT_FOUND") return res.status(404).json({ message: "Support ticket not found" });
  if (result.outcome === "CLOSED") {
    return res.status(409).json({ message: "This ticket is closed. Create a new request if you still need help." });
  }
  res.status(201).json({ message: result.message });
});

export default router;
