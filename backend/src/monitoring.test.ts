import { beforeEach, describe, expect, it } from "vitest";
import { getMonitoringSnapshot, recordError, recordRequest, resetMonitoringForTests } from "./monitoring.js";

describe("monitoring counters", () => {
  beforeEach(() => resetMonitoringForTests());

  it("aggregates request status families and duration", () => {
    recordRequest(200, 10);
    recordRequest(404, 30);

    expect(getMonitoringSnapshot().requests).toMatchObject({
      total: 2,
      errors: 0,
      statusCounts: { "2xx": 1, "4xx": 1 },
      averageDurationMs: 20
    });
  });

  it("keeps newest errors first without request bodies", () => {
    recordError({ requestId: "one", method: "GET", path: "/api/one", message: "first", occurredAt: "2026-01-01T00:00:00.000Z" });
    recordError({ requestId: "two", method: "POST", path: "/api/two", message: "second", occurredAt: "2026-01-01T00:01:00.000Z" });

    const snapshot = getMonitoringSnapshot();
    expect(snapshot.requests.errors).toBe(2);
    expect(snapshot.recentErrors.map((error) => error.requestId)).toEqual(["two", "one"]);
  });
});
