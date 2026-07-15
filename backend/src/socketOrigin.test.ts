import { describe, expect, it } from "vitest";
import { allowedClientOrigins } from "./env.js";
import { isAllowedSocketOrigin } from "./socket.js";

describe("Socket.IO origin protection", () => {
  it("accepts configured origins and rejects neighbouring subdomains", () => {
    expect(isAllowedSocketOrigin(allowedClientOrigins[0])).toBe(true);
    expect(isAllowedSocketOrigin("https://attacker.adilkan.com")).toBe(false);
  });
});
