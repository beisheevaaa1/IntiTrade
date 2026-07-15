import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { createRateLimit } from "../middleware/rateLimit.js";
import { recordError } from "../monitoring.js";

const router = Router();

const telemetryLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  key: (req) => req.ip ?? "unknown",
  message: "Telemetry rate limit reached"
});

const eventSchema = z.object({
  type: z.enum(["frontend_error", "api_error"]),
  message: z.string().trim().min(1).max(300),
  path: z.string().trim().max(300).regex(/^\//),
  requestId: z.string().uuid().optional()
});

export function sanitizeTelemetryMessage(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[token]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]")
    .slice(0, 300);
}

router.post("/", telemetryLimit, (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid telemetry event" });

  recordError({
    requestId: parsed.data.requestId ?? randomUUID(),
    method: parsed.data.type === "api_error" ? "API" : "FRONTEND",
    path: sanitizeTelemetryMessage(parsed.data.path),
    // Public clients report only a bounded event class. Do not persist
    // attacker-controlled exception text in the administrator dashboard.
    message: parsed.data.type === "api_error" ? "Client observed an API 5xx response" : "Frontend rendering error",
    occurredAt: new Date().toISOString()
  });
  res.status(202).end();
});

export default router;
