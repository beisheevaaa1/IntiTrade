import { prisma } from "./prisma.js";
import { env } from "./env.js";

export type LifecycleState = "starting" | "ready" | "shutting_down";

let lifecycleState: LifecycleState = "starting";
type ReadinessResult =
  | { ready: false; state: LifecycleState; database: "not_checked" | "unavailable" }
  | { ready: true; state: LifecycleState; database: "connected" };

let readinessCache: { expiresAt: number; value: ReadinessResult } | undefined;
let readinessInFlight: Promise<ReadinessResult> | undefined;

export function markReady() {
  lifecycleState = "ready";
}

export function markShuttingDown() {
  lifecycleState = "shutting_down";
}

export function getLifecycleState() {
  return lifecycleState;
}

async function defaultDatabaseCheck() {
  await prisma.$queryRawUnsafe("SELECT 1");
}

async function performReadinessCheck(databaseCheck: () => Promise<unknown>): Promise<ReadinessResult> {
  if (lifecycleState !== "ready") {
    return { ready: false, state: lifecycleState, database: "not_checked" };
  }

  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      databaseCheck(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("READINESS_TIMEOUT")), env.READINESS_TIMEOUT_MS);
      })
    ]);
    return { ready: true, state: lifecycleState, database: "connected" };
  } catch {
    return { ready: false, state: lifecycleState, database: "unavailable" };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function checkReadiness(databaseCheck: () => Promise<unknown> = defaultDatabaseCheck) {
  if (lifecycleState !== "ready") return performReadinessCheck(databaseCheck);
  if (databaseCheck !== defaultDatabaseCheck) return performReadinessCheck(databaseCheck);

  const now = Date.now();
  if (readinessCache && readinessCache.expiresAt > now) return readinessCache.value;
  if (readinessInFlight) return readinessInFlight;

  readinessInFlight = performReadinessCheck(databaseCheck)
    .then((value) => {
      readinessCache = { value, expiresAt: Date.now() + env.READINESS_CACHE_MS };
      return value;
    })
    .finally(() => {
      readinessInFlight = undefined;
    });
  return readinessInFlight;
}

export function resetLifecycleForTests() {
  lifecycleState = "starting";
  readinessCache = undefined;
  readinessInFlight = undefined;
}
