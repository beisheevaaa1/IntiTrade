import { describe, expect, it } from "vitest";
import { clearSessionCookie, sessionTokenFromCookie, setSessionCookie } from "./utils/sessionCookie.js";

function responseDouble() {
  const cookies: string[] = [];
  const headers = new Map<string, string>();
  return {
    cookies,
    headers,
    response: {
      append(name: string, value: string) {
        if (name.toLowerCase() === "set-cookie") cookies.push(value);
        return this;
      },
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
        return this;
      }
    }
  };
}

describe("session cookie", () => {
  it("parses the session without exposing it to script", () => {
    expect(sessionTokenFromCookie("theme=dark; intitrade_session=header.payload.signature; x=1")).toBe("header.payload.signature");
    const double = responseDouble();
    setSessionCookie(double.response as never, "header.payload.signature");
    expect(double.cookies[0]).toContain("HttpOnly");
    expect(double.cookies[0]).toContain("SameSite=Lax");
    expect(double.headers.get("cache-control")).toBe("no-store");
    expect(double.cookies[0]).not.toContain("Max-Age=");
    expect(sessionTokenFromCookie("intitrade_session=%")).toBeUndefined();
  });

  it("only persists the cookie when remember me is selected", () => {
    const double = responseDouble();
    setSessionCookie(double.response as never, "header.payload.signature", true);
    expect(double.cookies[0]).toContain("Max-Age=");
  });

  it("clears the host-only cookie", () => {
    const double = responseDouble();
    clearSessionCookie(double.response as never);
    expect(double.cookies[0]).toContain("Max-Age=0");
    expect(double.cookies[0]).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });
});
