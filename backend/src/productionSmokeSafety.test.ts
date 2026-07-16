import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(new URL("./scripts/productionSmoke.ts", import.meta.url), "utf8");

function ordered(first: string, second: string) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  expect(firstIndex).toBeGreaterThanOrEqual(0);
  expect(secondIndex).toBeGreaterThan(firstIndex);
}

describe("production smoke safety invariants", () => {
  it("proves the public API and local database identity before any registration POST", () => {
    expect(source).toContain("signAccessToken({ id: probe.id");
    expect(source).toContain('request("/api/auth/me")');
    ordered(
      "await verifyPublicApiDatabaseBinding(probeIdentity, tracked, abortSignal)",
      'await anonymousClient.request("/api/auth/register"'
    );
  });

  it("never discovers or deletes cleanup resources by the public marker", () => {
    const cleanupStart = source.indexOf("async function removeSharedTicketNotifications");
    const runStart = source.indexOf("async function runSmoke");
    const cleanupSource = source.slice(cleanupStart, runStart);
    expect(cleanupSource).not.toContain("title: marker");
    expect(cleanupSource).not.toContain("subject: marker");
    expect(cleanupSource).not.toContain("contains: ticketId");
    expect(cleanupSource).toContain("discoverOwnedResources");
  });

  it("handles terminal disconnects and isolates cleanup from the run abort signal", () => {
    expect(source).toContain('process.on("SIGHUP", onSighup)');
    expect(source).toContain("OVERALL_TIMEOUT_MS");
    expect(source).toContain("boundedSignal(this.abortSignal");
    expect(source).toContain("ownerClient.forCleanup().request");
  });

  it("freezes fixtures and checks foreign activity before cascade deletion", () => {
    ordered("await freezeTemporaryResources(tracked)", "await ensureNoForeignInteractions(tracked)");
    ordered("await ensureNoForeignInteractions(tracked)", "prisma.listing.deleteMany");
    expect(source).toContain("quarantineTemporaryAccounts");
    expect(source).toContain("tokenVersion: { increment: 1 }");
  });

  it("releases temporary reservation holds before archiving their listings", () => {
    ordered("await tx.transaction.updateMany", "await tx.listing.updateMany");
    expect(source).toContain("TransactionStatus.CANCELLED");
  });

  it("verifies every relationship table after cleanup", () => {
    for (const model of [
      "emailVerificationToken.count",
      "listingImage.count",
      "favorite.count",
      "conversation.count",
      "message.count",
      "report.count",
      "transaction.count",
      "review.count",
      "userBlock.count",
      "notification.count",
      "supportTicket.count",
      "supportTicketMessage.count",
      "adminActionLog.count"
    ]) {
      expect(source).toContain(`prisma.${model}`);
    }
  });

  it("uses an exclusive same-host lock with stale-lock recovery", () => {
    expect(source).toContain('fs.openSync(lockFile, "wx", 0o600)');
    expect(source).toContain("processIsRunning(existing.pid)");
    expect(source).toContain("Recovered a stale same-host production smoke lock");
    expect(source).toContain("releaseRunLock(heldRunLock)");
  });
});
