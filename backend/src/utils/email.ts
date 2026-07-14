import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "../env.js";

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Verify your University Marketplace account",
    text: `Verify your account: ${verifyUrl}`,
    html: `<p>Verify your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
  });
}
