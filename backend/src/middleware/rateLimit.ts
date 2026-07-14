import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  message?: string;
};

type Bucket = { count: number; resetAt: number };

export function createRateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  let nextSweepAt = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now >= nextSweepAt) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      nextSweepAt = now + options.windowMs;
    }

    const key = options.key?.(req) || req.ip || req.socket.remoteAddress || "unknown";
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ message: options.message || "Too many requests. Please try again later." });
    }

    next();
  };
}
