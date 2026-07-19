import { describe, expect, it } from "vitest";
import { createToken, createVerificationCode, hashToken } from "./utils/email.js";

describe("email verification credentials", () => {
  it("creates a six-digit screen verification code", () => {
    const code = createVerificationCode();

    expect(code).toMatch(/^\d{6}$/);
  });

  it("creates and hashes a private email token", () => {
    const token = createToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
});
