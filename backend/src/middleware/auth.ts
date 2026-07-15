import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { verifyAccessToken } from "../utils/auth.js";
import { clearSessionCookie, sessionTokenFromCookie } from "../utils/sessionCookie.js";

function requestToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : sessionTokenFromCookie(req.headers.cookie);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = requestToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.isBlocked || payload.tokenVersion !== user.tokenVersion) {
      clearSessionCookie(res);
      return res.status(401).json({ message: "Account is unavailable" });
    }
    req.user = { id: user.id, role: user.role };

    // Async throttled update of lastActiveAt
    const now = new Date();
    const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : new Date(0);
    if (now.getTime() - lastActive.getTime() > 60 * 1000) {
      prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: now }
      }).catch(() => console.error(JSON.stringify({ level: "error", event: "last_active_update_failed" })));
    }

    next();
  } catch {
    clearSessionCookie(res);
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = requestToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, role: true, isBlocked: true, tokenVersion: true } });
    if (user && !user.isBlocked && payload.tokenVersion === user.tokenVersion) req.user = { id: user.id, role: user.role };
  } catch {
    // Public routes remain public when a stale token is supplied.
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
