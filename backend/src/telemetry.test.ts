import { describe, expect, it } from "vitest";
import { sanitizeTelemetryMessage } from "./routes/telemetry.js";

describe("telemetry privacy", () => {
  it("redacts contact details and token-shaped values", () => {
    const result = sanitizeTelemetryMessage("user@example.com +60123456789 abcdefghijklmnopqrstuvwxyz1234567890");
    expect(result).toContain("[email]");
    expect(result).toContain("[phone]");
    expect(result).toContain("[token]");
    expect(result).not.toContain("user@example.com");
  });
});
