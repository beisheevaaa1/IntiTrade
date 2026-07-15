import { describe, expect, it } from "vitest";
import { createSocketEventLimiter } from "./socket.js";

describe("Socket.IO account rate limiting", () => {
  it("shares one message window across all sockets for a user", () => {
    const allow = createSocketEventLimiter();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      expect(allow("user-1", "message:send", 12, 10_000)).toBe(true);
    }
    expect(allow("user-1", "message:send", 12, 10_000)).toBe(false);
    expect(allow("user-2", "message:send", 12, 10_000)).toBe(true);
  });
});
