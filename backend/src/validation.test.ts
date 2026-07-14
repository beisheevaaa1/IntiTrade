import { describe, expect, it } from "vitest";
import { getAllowedEmailDomains, isAllowedEmail, isPasswordWithinBcryptLimit, normalizePhone } from "./utils/validation.js";

describe("email domain validation", () => {
  it("allows any valid email when no domain restriction is configured", () => {
    expect(isAllowedEmail("student@example.com", getAllowedEmailDomains(""))).toBe(true);
  });

  it("supports a comma-separated allowlist", () => {
    const domains = getAllowedEmailDomains("inti.edu.my, @student.newinti.edu.my");
    expect(isAllowedEmail("student@student.newinti.edu.my", domains)).toBe(true);
    expect(isAllowedEmail("student@example.com", domains)).toBe(false);
  });
});

describe("phone normalization", () => {
  it("normalizes Malaysian local numbers to E.164", () => {
    expect(normalizePhone("012-345 6789")).toBe("+60123456789");
  });

  it("keeps a valid international number and rejects invalid input", () => {
    expect(normalizePhone("+996 555 123 456")).toBe("+996555123456");
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("password byte limit", () => {
  it("uses bytes rather than JavaScript character count for bcrypt safety", () => {
    expect(isPasswordWithinBcryptLimit("a".repeat(72))).toBe(true);
    expect(isPasswordWithinBcryptLimit("a".repeat(73))).toBe(false);
    expect(isPasswordWithinBcryptLimit("🙂".repeat(19))).toBe(false);
  });
});
