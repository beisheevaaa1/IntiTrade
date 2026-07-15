import type { Response } from "express";
import { env } from "../env.js";

export const SESSION_COOKIE_NAME = "intitrade_session";

export function sessionTokenFromCookie(cookieHeader?: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function cookieAttributes(maxAge?: number) {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    env.NODE_ENV === "production" ? "Secure" : "",
    maxAge === undefined ? "" : `Max-Age=${maxAge}`
  ].filter(Boolean).join("; ");
}

export function setSessionCookie(res: Response, token: string, persistent = false) {
  const maxAge = persistent ? env.SESSION_COOKIE_MAX_AGE_SECONDS : undefined;
  res.append("Set-Cookie", `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes(maxAge)}`);
  res.setHeader("Cache-Control", "no-store");
}

export function clearSessionCookie(res: Response) {
  res.append("Set-Cookie", `${SESSION_COOKIE_NAME}=; ${cookieAttributes(0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.setHeader("Cache-Control", "no-store");
}
