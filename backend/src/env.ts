import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().default(4000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(1),
  APP_VERSION: z.string().trim().max(100).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  READINESS_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(2_000),
  READINESS_CACHE_MS: z.coerce.number().int().min(250).max(60_000).default(5_000),
  UPLOAD_MAX_VIDEO_MB: z.coerce.number().int().min(1).max(100).default(25),
  UPLOAD_MAX_USER_MB: z.coerce.number().int().min(25).max(10_000).default(250),
  UPLOAD_MAX_TOTAL_MB: z.coerce.number().int().min(250).max(100_000).default(5_000),
  UPLOAD_ORPHAN_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default("development-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  SESSION_COOKIE_MAX_AGE_SECONDS: z.coerce.number().int().min(300).max(31_536_000).default(604_800),
  EMAIL_VERIFICATION_REQUIRED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  EMAIL_VERIFICATION_DELIVERY: z.enum(["email", "screen"]).default("email"),
  ALLOWED_EMAIL_DOMAINS: z.string().default(""),
  ALLOWED_EMAIL_DOMAIN: z.string().optional(),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  CLIENT_URLS: z.string().default(""),
  API_URL: z.string().default("http://localhost:4000"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("University Marketplace <no-reply@marketplace.local>")
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;

  if (!value.DATABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required in production"
    });
  }

  if (value.JWT_SECRET === "development-secret-change-me" || value.JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "JWT_SECRET must be a non-default secret of at least 32 characters in production"
    });
  }
});

export const env = schema.parse(process.env);

export const allowedClientOrigins = Array.from(new Set([
  env.CLIENT_URL,
  ...env.CLIENT_URLS.split(",").map((origin) => origin.trim()).filter(Boolean)
]));
