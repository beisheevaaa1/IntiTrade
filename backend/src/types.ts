import type { Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  role: Role;
};

export type AccessTokenPayload = AuthUser & {
  tokenVersion: number;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
