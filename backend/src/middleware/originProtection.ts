import type { RequestHandler } from "express";
import { allowedClientOrigins } from "../env.js";
import { SESSION_COOKIE_NAME } from "../utils/sessionCookie.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const configuredOrigins = new Set(allowedClientOrigins);

function requestOrigin(req: Parameters<RequestHandler>[0]) {
  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : undefined;
}

export function isAllowedMutationOrigin(origin: string, sameOrigin?: string) {
  return origin === sameOrigin || configuredOrigins.has(origin);
}

export const originProtection: RequestHandler = (req, res, next) => {
  if (safeMethods.has(req.method)) return next();

  const origin = req.get("origin");
  if (origin && !isAllowedMutationOrigin(origin, requestOrigin(req))) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }

  const hasSessionCookie = req.headers.cookie?.split(";").some((part) => part.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
  const hasBearer = /^Bearer\s+\S+$/i.test(req.get("authorization") || "");
  if (hasSessionCookie && !hasBearer && !origin) {
    return res.status(403).json({ message: "An Origin header is required for cookie-authenticated changes" });
  }

  next();
};
