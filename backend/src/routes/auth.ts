import bcrypt from "bcryptjs";
import { Prisma, SellerType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { createToken, hashToken, sendVerificationEmail } from "../utils/email.js";
import { sanitizeUser, signAccessToken } from "../utils/auth.js";
import { getAllowedEmailDomains, isAllowedEmail, isPasswordWithinBcryptLimit, normalizeIntiAccountIdentifier, normalizePhone } from "../utils/validation.js";
import { clearSessionCookie, setSessionCookie } from "../utils/sessionCookie.js";
import { isOwnedImageUploadUrl } from "../utils/uploadOwnership.js";
import { lockMessageAccounts } from "../utils/messageLocks.js";

const router = Router();
const allowedEmailDomains = getAllowedEmailDomains(env.ALLOWED_EMAIL_DOMAINS, env.ALLOWED_EMAIL_DOMAIN);
const studentEmailDomain = "student.newinti.edu.my";

const accountEmailSchema = z.string()
  .trim()
  .min(1)
  .transform((value) => normalizeIntiAccountIdentifier(value, studentEmailDomain))
  .pipe(z.string().email());

const authIpRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many authentication attempts from this network. Please try again later."
});

const authAccountRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => normalizeIntiAccountIdentifier(String(req.body?.email || "unknown-account"), studentEmailDomain),
  message: "Too many authentication attempts. Please try again later."
});

const registrationIpRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many accounts were created from this network. Please try again later."
});

const verificationRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}:${String(req.body?.email || req.body?.token || "").toLowerCase()}`,
  message: "Too many verification attempts. Please try again later."
});

const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid international phone number" });
    return z.NEVER;
  }
  return normalized;
});

const passwordSchema = z.string()
  .min(8, "Password must contain at least 8 characters")
  .refine(isPasswordWithinBcryptLimit, "Password is too long");

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: accountEmailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  accountType: z.enum(["STUDENT", "STAFF"]).optional().default("STUDENT"),
  faculty: z.string().trim().max(120).nullable().optional()
});

function accessTokenFor(user: { id: string; role: "STUDENT" | "ADMIN"; tokenVersion: number }) {
  return signAccessToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });
}

router.post("/register", authIpRateLimit, registrationIpRateLimit, authAccountRateLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid registration data", errors: parsed.error.flatten() });

  const email = parsed.data.email.toLowerCase();
  if (!isAllowedEmail(email, allowedEmailDomains)) {
    return res.status(400).json({ message: "Registration requires an official INTI institutional email (@newinti.edu.my for Staff, @student.newinti.edu.my for Students). Personal emails are not permitted." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const rawVerificationToken = env.EMAIL_VERIFICATION_REQUIRED ? createToken() : null;
  const facultyText = parsed.data.faculty
    ? `${parsed.data.accountType === "STAFF" ? "INTI Staff" : "INTI Student"} • ${parsed.data.faculty}`
    : (parsed.data.accountType === "STAFF" ? "INTI Staff" : "INTI Student");

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: parsed.data.name,
          phone: parsed.data.phone,
          passwordHash,
          faculty: facultyText,
          isVerified: !rawVerificationToken
        }
      });

      if (rawVerificationToken) {
        await tx.emailVerificationToken.create({
          data: {
            token: hashToken(rawVerificationToken),
            userId: created.id,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
          }
        });
      }
      return created;
    });

    if (rawVerificationToken) {
      try {
        await sendVerificationEmail(user.email, rawVerificationToken);
      } catch (error) {
        console.error(JSON.stringify({ level: "error", event: "verification_email_failed", errorType: error instanceof Error ? error.name : "UnknownError" }));
        return res.status(503).json({
          message: "Your account was created, but the verification email could not be sent. Please use resend verification later.",
          requiresVerification: true,
          verificationToken: rawVerificationToken,
          verificationCode: rawVerificationToken.slice(0, 6)
        });
      }
    }

    if (!rawVerificationToken) setSessionCookie(res, accessTokenFor(user));
    res.status(201).json({
      user: sanitizeUser(user),
      requiresVerification: Boolean(rawVerificationToken),
      verificationToken: rawVerificationToken || undefined,
      verificationCode: rawVerificationToken ? rawVerificationToken.slice(0, 6) : undefined
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Email or phone number is already registered" });
    }
    throw error;
  }
});

router.post("/verify-email", authIpRateLimit, verificationRateLimit, async (req, res) => {
  if (!env.EMAIL_VERIFICATION_REQUIRED) return res.status(404).json({ message: "Email verification is not enabled" });

  const parsed = z.object({ token: z.string().min(32).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Verification token is required" });

  const record = await prisma.emailVerificationToken.findUnique({ where: { token: hashToken(parsed.data.token) } });
  if (!record || record.expiresAt < new Date()) return res.status(400).json({ message: "Invalid or expired verification token" });

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: record.userId }, data: { isVerified: true } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: record.userId } });
    return updated;
  });

  setSessionCookie(res, accessTokenFor(user));
  res.json({ user: sanitizeUser(user) });
});

router.post("/resend-verification", authIpRateLimit, verificationRateLimit, async (req, res) => {
  const parsed = z.object({ email: accountEmailSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "A valid email is required" });

  const genericResponse = { message: "If the account requires verification, a new email has been sent." };
  if (!env.EMAIL_VERIFICATION_REQUIRED) return res.json(genericResponse);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || user.isVerified || user.isBlocked) return res.json(genericResponse);

  const rawToken = createToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.create({
      data: { token: hashToken(rawToken), userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) }
    })
  ]);
  await sendVerificationEmail(user.email, rawToken);
  res.json(genericResponse);
});

router.post("/login", authIpRateLimit, authAccountRateLimit, async (req, res) => {
  const parsed = z.object({
    email: z.string().trim().min(1),
    password: z.string().min(1).max(200),
    rememberMe: z.boolean().optional().default(false)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid login data" });

  const rawInput = parsed.data.email.toLowerCase();
  const candidates = new Set<string>();
  candidates.add(rawInput);
  if (rawInput.includes("@")) {
    const localPart = rawInput.split("@")[0];
    const domainPart = rawInput.split("@")[1];
    if (domainPart === "student.newinti.edu.my" || domainPart === "newinti.edu.my") {
      if (localPart.startsWith("inti_")) {
        candidates.add(`${localPart.replace("inti_", "")}@${domainPart}`);
      } else {
        candidates.add(`inti_${localPart}@${domainPart}`);
      }
    }
  } else {
    const idOnly = rawInput.replace(/^inti_/, "");
    candidates.add(`${idOnly}@student.newinti.edu.my`);
    candidates.add(`inti_${idOnly}@student.newinti.edu.my`);
    candidates.add(`${idOnly}@newinti.edu.my`);
    candidates.add(`inti_${idOnly}@newinti.edu.my`);
  }

  const user = await prisma.user.findFirst({
    where: { OR: Array.from(candidates).map(email => ({ email })) }
  });

  if (!user) return res.status(401).json({ message: "Invalid email or password" });
  if (user.isBlocked) return res.status(403).json({ message: "Your account is blocked" });

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) return res.status(401).json({ message: "Invalid email or password" });

  if (env.EMAIL_VERIFICATION_REQUIRED && !user.isVerified) {
    return res.status(403).json({ message: "Verify your email before logging in" });
  }

  setSessionCookie(res, accessTokenFor(user), parsed.data.rememberMe);
  res.json({ user: sanitizeUser(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ user: sanitizeUser(user) });
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional(),
  faculty: z.string().trim().max(120).nullable().optional(),
  campusArea: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
  autoReplyEnabled: z.boolean().optional(),
  autoReplyMessage: z.string().trim().max(500).optional(),
  autoReplyDelay: z.number().int().min(0).max(1440).optional(),
  showOnlineStatus: z.boolean().optional(),
  sellerType: z.nativeEnum(SellerType).optional(),
  showEmail: z.boolean().optional(),
  showCampusArea: z.boolean().optional(),
  allowMessages: z.boolean().optional(),
  showAcademicProfile: z.boolean().optional(),
  resume: z.string().trim().max(3000).optional(),
  projects: z.string().trim().max(5000).optional(),
  academicTipShown: z.boolean().optional()
});

router.patch("/profile", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid profile data", errors: parsed.error.flatten() });

  if (parsed.data.avatarUrl) {
    const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatarUrl: true } });
    if (parsed.data.avatarUrl !== current?.avatarUrl && !isOwnedImageUploadUrl(req.user!.id, parsed.data.avatarUrl)) {
      return res.status(403).json({ message: "A profile can only use an image uploaded by its owner" });
    }
  }

  try {
    const changesAutoReply = parsed.data.autoReplyEnabled !== undefined
      || parsed.data.autoReplyMessage !== undefined
      || parsed.data.autoReplyDelay !== undefined;
    const updated = changesAutoReply
      ? await prisma.$transaction(async (tx) => {
        await lockMessageAccounts(tx, req.user!.id);
        return tx.user.update({ where: { id: req.user!.id }, data: parsed.data });
      })
      : await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data });
    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "This phone number is already registered" });
    }
    throw error;
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } });
  clearSessionCookie(res);
  res.status(204).send();
});

export default router;
