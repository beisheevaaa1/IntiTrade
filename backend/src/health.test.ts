import { afterEach, describe, expect, it } from "vitest";
import { checkReadiness, markReady, markShuttingDown, resetLifecycleForTests } from "./health.js";

describe("readiness", () => {
  afterEach(() => resetLifecycleForTests());

  it("does not query the database while starting", async () => {
    let called = false;
    const result = await checkReadiness(async () => { called = true; });
    expect(result.ready).toBe(false);
    expect(called).toBe(false);
  });

  it("is ready only when the database responds", async () => {
    markReady();
    await expect(checkReadiness(async () => undefined)).resolves.toMatchObject({ ready: true, database: "connected" });
    await expect(checkReadiness(async () => { throw new Error("offline"); })).resolves.toMatchObject({ ready: false, database: "unavailable" });
  });

  it("becomes unavailable before shutdown", async () => {
    markReady();
    markShuttingDown();
    await expect(checkReadiness(async () => undefined)).resolves.toMatchObject({ ready: false, state: "shutting_down" });
  });
});
