import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { env } from "../env.js";
import { recordError, recordRequest } from "../monitoring.js";

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incomingId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined;
  const requestId = isUuid(incomingId) ? incomingId : randomUUID();
  const startedAt = process.hrtime.bigint();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    recordRequest(res.statusCode, durationMs);
    if (env.NODE_ENV === "production") {
      console.log(JSON.stringify({
        level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
        event: "http_request",
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        at: new Date().toISOString()
      }));
    }
  });

  next();
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const requestId = String(res.locals.requestId ?? randomUUID());
  const databaseError = error && typeof error === "object" && !Array.isArray(error)
    ? error as { code?: unknown; meta?: unknown }
    : null;
  recordError({
    requestId,
    method: req.method,
    path: req.path,
    message: "Unexpected server error",
    occurredAt: new Date().toISOString()
  });
  console.error(JSON.stringify({
    level: "error",
    event: "request_failed",
    requestId,
    method: req.method,
    path: req.path,
    errorType: error instanceof Error ? error.name : "UnknownError",
    errorCode: typeof databaseError?.code === "string" ? databaseError.code : undefined,
    errorMeta: databaseError?.meta,
    at: new Date().toISOString()
  }));
  if (res.headersSent) return next(error);
  res.status(500).json({ message: "Unexpected server error", errorId: requestId });
};
