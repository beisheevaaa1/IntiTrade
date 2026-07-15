import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { signAccessToken } from "./utils/auth.js";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  supportFindFirst: vi.fn(),
  supportCount: vi.fn(),
  supportFindMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("./prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: vi.fn() },
    supportTicket: {
      findFirst: mocks.supportFindFirst,
      count: mocks.supportCount,
      findMany: mocks.supportFindMany
    },
    $transaction: mocks.transaction
  }
}));

import { createApp } from "./app.js";

const userId = "11111111-1111-4111-8111-111111111111";
const token = signAccessToken({ id: userId, role: Role.STUDENT, tokenVersion: 0 });
let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({
    id: userId,
    role: Role.STUDENT,
    isBlocked: false,
    tokenVersion: 0,
    lastActiveAt: new Date()
  });
  mocks.supportFindFirst.mockResolvedValue(null);
  mocks.transaction.mockResolvedValue([0, []]);
  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("support route authorization", () => {
  it("rejects anonymous access", async () => {
    const response = await fetch(`${baseUrl}/api/support`);
    expect(response.status).toBe(401);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("does not allow a student into admin support routes", async () => {
    const response = await fetch(`${baseUrl}/api/support/admin`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.status).toBe(403);
    expect(mocks.supportFindMany).not.toHaveBeenCalled();
  });

  it("always scopes message history to the authenticated owner", async () => {
    const response = await fetch(`${baseUrl}/api/support/22222222-2222-4222-8222-222222222222/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.status).toBe(404);
    expect(mocks.supportFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "22222222-2222-4222-8222-222222222222", userId }
    }));
  });

  it("accepts the HttpOnly session cookie without a bearer token", async () => {
    const response = await fetch(`${baseUrl}/api/support`, {
      headers: { Cookie: `intitrade_session=${token}` }
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tickets: [] });
  });
});
