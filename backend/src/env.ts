import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default("development-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ALLOWED_EMAIL_DOMAIN: z.string().default("gmail.com"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  API_URL: z.string().default("http://localhost:4000"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("University Marketplace <no-reply@marketplace.local>")
});

export const env = schema.parse(process.env);
