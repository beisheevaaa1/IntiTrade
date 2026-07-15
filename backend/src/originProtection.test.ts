import { describe, expect, it, vi } from "vitest";
import { originProtection } from "./middleware/originProtection.js";

function invoke(input: { method?: string; origin?: string; cookie?: string; authorization?: string; protocol?: string; host?: string }) {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const next = vi.fn();
  const headers: Record<string, string | undefined> = {
    origin: input.origin,
    authorization: input.authorization,
    host: input.host || "intitrade.shop"
  };
  originProtection({
    method: input.method || "POST",
    protocol: input.protocol || "https",
    headers: { cookie: input.cookie },
    get(name: string) { return headers[name.toLowerCase()]; }
  } as never, { status, json } as never, next);
  return { status, json, next };
}

describe("mutation origin protection", () => {
  it("rejects a cross-origin browser mutation", () => {
    const result = invoke({ origin: "https://attacker.adilkan.com", cookie: "intitrade_session=token" });
    expect(result.status).toHaveBeenCalledWith(403);
    expect(result.next).not.toHaveBeenCalled();
  });

  it("accepts same-origin cookie mutations", () => {
    const result = invoke({ origin: "https://intitrade.shop", cookie: "intitrade_session=token" });
    expect(result.next).toHaveBeenCalledOnce();
  });

  it("keeps no-origin bearer clients compatible", () => {
    const result = invoke({ authorization: "Bearer api-token" });
    expect(result.next).toHaveBeenCalledOnce();
  });
});
