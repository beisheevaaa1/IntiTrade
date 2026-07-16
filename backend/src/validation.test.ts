import { describe, expect, it } from "vitest";
import { getAllowedEmailDomains, isAllowedEmail, isPasswordWithinBcryptLimit, listingMediaValidationMessage, normalizeIntiAccountIdentifier, normalizePhone } from "./utils/validation.js";

describe("email domain validation", () => {
  it("allows any valid email when no domain restriction is configured", () => {
    expect(isAllowedEmail("student@example.com", getAllowedEmailDomains(""))).toBe(true);
  });

  it("supports a comma-separated allowlist", () => {
    const domains = getAllowedEmailDomains("inti.edu.my, @student.newinti.edu.my");
    expect(isAllowedEmail("student@student.newinti.edu.my", domains)).toBe(true);
    expect(isAllowedEmail("student@example.com", domains)).toBe(false);
  });

  it("normalizes a short INTI student ID into the student email account", () => {
    expect(normalizeIntiAccountIdentifier("I00008872")).toBe("i00008872@student.newinti.edu.my");
    expect(normalizeIntiAccountIdentifier("i00008872@student.newinti.edu.my")).toBe("i00008872@student.newinti.edu.my");
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

describe("listing media limits", () => {
  it("allows up to twenty photos and five videos", () => {
    const photos = Array.from({ length: 20 }, (_, index) => `/uploads/user-photo-${index}.webp`);
    const videos = Array.from({ length: 5 }, (_, index) => `/uploads/user-video-${index}.mp4`);
    expect(listingMediaValidationMessage([...photos, ...videos])).toBeNull();
  });

  it("rejects excess photos, excess videos, and unsupported attachments", () => {
    expect(listingMediaValidationMessage(Array.from({ length: 21 }, (_, index) => `/uploads/${index}.png`))).toMatch(/20 photos/);
    expect(listingMediaValidationMessage(Array.from({ length: 6 }, (_, index) => `/uploads/${index}.webm`))).toMatch(/5 videos/);
    expect(listingMediaValidationMessage(["/uploads/file.pdf"])).toMatch(/supported photo or video/);
  });
});
