import { ListingStatus, Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canChangeUserBlock, canModerateListing } from "./utils/adminRules.js";

describe("admin moderation rules", () => {
  it("allows pending listings to be approved or rejected", () => {
    expect(canModerateListing(ListingStatus.PENDING, ListingStatus.ACTIVE)).toBe(true);
    expect(canModerateListing(ListingStatus.PENDING, ListingStatus.REJECTED)).toBe(true);
  });

  it("prevents reopening a sold listing directly", () => {
    expect(canModerateListing(ListingStatus.SOLD, ListingStatus.ACTIVE)).toBe(false);
  });

  it("prevents self-block, admin blocking, and no-op changes", () => {
    expect(canChangeUserBlock("admin", { id: "admin", role: Role.ADMIN, isBlocked: false }, true).reason).toBe("SELF_BLOCK");
    expect(canChangeUserBlock("one", { id: "two", role: Role.ADMIN, isBlocked: false }, true).reason).toBe("ADMIN_TARGET");
    expect(canChangeUserBlock("one", { id: "student", role: Role.STUDENT, isBlocked: true }, true).reason).toBe("NO_CHANGE");
  });

  it("allows a real student block-status change", () => {
    expect(canChangeUserBlock("admin", { id: "student", role: Role.STUDENT, isBlocked: false }, true)).toEqual({ allowed: true, reason: null });
  });
});
