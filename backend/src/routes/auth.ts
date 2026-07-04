import bcrypt from "bcryptjs";
import { SellerType } from "@prisma/client";
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
  const parsed = z.object({ email: z.string().min(1), password: z.string().min(1) }).safeParse(req.body);
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
  let user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  
  if (user.gpa === null) {
    const randomGpa = parseFloat((Math.random() * (4.0 - 3.2) + 3.2).toFixed(2));
    const gradesMap: Record<string, Array<{ course: string; grade: string }>> = {
      "Computer Science": [
        { course: "Data Structures & Algorithms", grade: "A" },
        { course: "Database Management Systems", grade: "A-" },
        { course: "Object Oriented Programming", grade: "A" },
        { course: "Calculus & Linear Algebra", grade: "B+" }
      ],
      "Business": [
        { course: "Introduction to Economics", grade: "A" },
        { course: "Principles of Marketing", grade: "A" },
        { course: "Business Finance", grade: "B+" },
        { course: "Organizational Behaviour", grade: "A-" }
      ],
      "Engineering": [
        { course: "Calculus I & II", grade: "A" },
        { course: "Engineering Physics", grade: "A-" },
        { course: "Circuit Theory", grade: "B+" },
        { course: "Digital Electronics", grade: "A" }
      ]
    };
    
    const facultyKey = user.faculty || "Computer Science";
    const selectedGrades = gradesMap[facultyKey] || gradesMap["Computer Science"];
    
    const randomProjects = `- IntiCampus Marketplace: A peer-to-peer web application for INTI students to trade textbooks and electronics.\n- Smart Study Assistant: A machine learning based calendar app that schedules study blocks based on student workload.`;
    
    const defaultResume = `Motivated student at INTI University pursuing ${facultyKey}. Active member of academic clubs and experienced in university group projects. Seeking tutoring opportunities to help other students succeed.`;

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        gpa: randomGpa,
        academicGrades: JSON.stringify(selectedGrades),
        projects: randomProjects,
        resume: defaultResume
      }
    });
  }

  res.json({ user: sanitizeUser(user) });
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  faculty: z.string().max(120).nullable().optional(),
  campusArea: z.string().max(120).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  autoReplyEnabled: z.boolean().optional(),
  autoReplyMessage: z.string().max(500).optional(),
  autoReplyDelay: z.number().nonnegative().optional(),
  showOnlineStatus: z.boolean().optional(),
  sellerType: z.nativeEnum(SellerType).optional(),
  showEmail: z.boolean().optional(),
  showCampusArea: z.boolean().optional(),
  allowMessages: z.boolean().optional(),
  showAcademicProfile: z.boolean().optional(),
  gpa: z.number().optional(),
  academicGrades: z.string().optional(),
  resume: z.string().optional(),
  projects: z.string().optional(),
  academicTipShown: z.boolean().optional()
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
