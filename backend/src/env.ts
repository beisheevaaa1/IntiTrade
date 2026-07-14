import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().default(4000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(1),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default("development-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  EMAIL_VERIFICATION_REQUIRED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  ALLOWED_EMAIL_DOMAINS: z.string().default(""),
  ALLOWED_EMAIL_DOMAIN: z.string().optional(),
  CLIENT_URL: z.string().default("http://localhost:5173"),
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
