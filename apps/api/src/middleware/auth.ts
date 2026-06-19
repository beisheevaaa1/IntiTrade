import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { verifyAccessToken } from "../utils/auth.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.isBlocked) {
      return res.status(401).json({ message: "Account is unavailable" });
    }
    req.user = { id: user.id, role: user.role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
