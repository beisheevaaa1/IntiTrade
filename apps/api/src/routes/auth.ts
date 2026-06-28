import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createToken, sendVerificationEmail } from "../utils/email.js";
import { sanitizeUser, signAccessToken } from "../utils/auth.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8)
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid registration data", errors: parsed.error.flatten() });

  const email = parsed.data.email.toLowerCase();
  const domain = email.split("@")[1];
  if (domain !== env.ALLOWED_EMAIL_DOMAIN) {
    return res.status(400).json({ message: `Use an email ending in @${env.ALLOWED_EMAIL_DOMAIN}` });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: "Email is already registered" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash
    }
  });

  const token = createToken();
  await prisma.emailVerificationToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
    }
  });

  try {
    await sendVerificationEmail(user.email, token);
  } catch (error) {
    console.warn("Verification email was not sent:", error);
  }

  res.status(201).json({
    user: sanitizeUser(user),
    verificationToken: env.NODE_ENV === "production" ? undefined : token
  });
});

router.post("/verify-email", async (req, res) => {
  const parsed = z.object({ token: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Verification token is required" });

  const record = await prisma.emailVerificationToken.findUnique({ where: { token: parsed.data.token } });
  if (!record || record.expiresAt < new Date()) return res.status(400).json({ message: "Invalid or expired verification token" });

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: { isVerified: true }
  });
  await prisma.emailVerificationToken.delete({ where: { id: record.id } });

  res.json({ user: sanitizeUser(user), token: signAccessToken({ id: user.id, role: user.role }) });
});

router.post("/login", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid login data" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return res.status(401).json({ message: "Invalid email or password" });

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) return res.status(401).json({ message: "Invalid email or password" });
  if (!user.isVerified) return res.status(403).json({ message: "Verify your email before logging in" });
  if (user.isBlocked) return res.status(403).json({ message: "Your account is blocked" });

  res.json({ user: sanitizeUser(user), token: signAccessToken({ id: user.id, role: user.role }) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ user: sanitizeUser(user) });
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  faculty: z.string().max(120).nullable().optional(),
  campusArea: z.string().max(120).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().nullable().optional()
});

router.patch("/profile", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid profile data", errors: parsed.error.flatten() });

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: parsed.data
  });

  res.json({ user: sanitizeUser(updated) });
});

router.post("/logout", (_req, res) => {
  res.status(204).send();
});

export default router;
