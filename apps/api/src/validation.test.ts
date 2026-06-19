import { describe, expect, it } from "vitest";

function isAllowedEmail(email: string, domain: string) {
  return email.toLowerCase().split("@")[1] === domain;
}

describe("email domain validation", () => {
  it("accepts the configured capstone demo domain", () => {
    expect(isAllowedEmail("student@gmail.com", "gmail.com")).toBe(true);
  });

  it("rejects non-matching domains", () => {
    expect(isAllowedEmail("student@example.com", "gmail.com")).toBe(false);
  });
});
