import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { writeAdminAction } from "./services/adminAudit.js";

describe("admin audit writer", () => {
  it("stores an actor snapshot and safe change metadata", async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue({ email: "admin@example.test", role: "ADMIN" }) },
      adminActionLog: { create }
    } as unknown as Prisma.TransactionClient;

    await writeAdminAction(tx, {
      adminId: "admin-id",
      requestId: "request-id",
      action: "USER_BLOCK",
      entityType: "User",
      entityId: "student-id",
      reason: "Safety review",
      before: { isBlocked: false },
      after: { isBlocked: true }
    });

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorEmail: "admin@example.test",
      actorRole: "ADMIN",
      requestId: "request-id",
      before: { isBlocked: false },
      after: { isBlocked: true }
    }) });
  });
});
