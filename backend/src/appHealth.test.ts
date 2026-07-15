import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { resetLifecycleForTests } from "./health.js";

describe("health endpoints", () => {
  afterEach(() => resetLifecycleForTests());

  it("keeps liveness available while readiness reports startup", async () => {
    const server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const live = await fetch(`http://127.0.0.1:${port}/api/health/live`);
      const ready = await fetch(`http://127.0.0.1:${port}/api/health/ready`);
      expect(live.status).toBe(200);
      expect(await live.json()).toMatchObject({ ok: true, state: "starting" });
      expect(ready.status).toBe(503);
      expect(await ready.json()).toMatchObject({ ready: false, state: "starting" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
