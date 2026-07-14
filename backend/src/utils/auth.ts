import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { AccessTokenPayload } from "../types.js";

export function signAccessToken(user: AccessTokenPayload) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function sanitizeUser<T extends { passwordHash?: string; tokenVersion?: number }>(user: T) {
  const { passwordHash: _passwordHash, tokenVersion: _tokenVersion, ...safeUser } = user;
  return safeUser;
}
