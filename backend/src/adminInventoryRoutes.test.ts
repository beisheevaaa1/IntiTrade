import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingStatus, ListingType, Prisma, Role, TransactionStatus } from "@prisma/client";
import { signAccessToken } from "./utils/auth.js";

const mocks = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const userUpdate = vi.fn();
  const transactionFindFirst = vi.fn();
  const transactionUpdateMany = vi.fn();
  const transactionFindUniqueOrThrow = vi.fn();
  const listingFindUnique = vi.fn();
  const listingUpdateMany = vi.fn();
  const notificationCreate = vi.fn();
  const auditUserFindUnique = vi.fn();
  const adminActionLogCreate = vi.fn();
  const queryRaw = vi.fn();
  const databaseTransaction = vi.fn();

  const tx = {
    $queryRaw: queryRaw,
    $executeRaw: queryRaw,
    transaction: {
      updateMany: transactionUpdateMany,
      findUniqueOrThrow: transactionFindUniqueOrThrow
    },
    listing: {
      findUnique: listingFindUnique,
      updateMany: listingUpdateMany
    },
    notification: { create: notificationCreate },
    user: { findUnique: auditUserFindUnique },
    adminActionLog: { create: adminActionLogCreate }
  };

  return {
    userFindUnique,
    userUpdate,
    transactionFindFirst,
    transactionUpdateMany,
    transactionFindUniqueOrThrow,
    listingFindUnique,
    listingUpdateMany,
    notificationCreate,
    auditUserFindUnique,
    adminActionLogCreate,
    queryRaw,
    databaseTransaction,
    tx
  };
});

vi.mock("./prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    transaction: { findFirst: mocks.transactionFindFirst },
    $transaction: mocks.databaseTransaction
  }
}));

import { createApp } from "./app.js";

const adminId = "11111111-1111-4111-8111-111111111111";
const buyerId = "22222222-2222-4222-8222-222222222222";
const sellerId = "33333333-3333-4333-8333-333333333333";
const listingId = "44444444-4444-4444-8444-444444444444";
const transactionId = "55555555-5555-4555-8555-555555555555";
const adminToken = signAccessToken({ id: adminId, role: Role.ADMIN, tokenVersion: 0 });

const approvedSnapshot = {
  _snapshotVersion: 1,
  _snapshotProvenance: "captured",
  id: listingId,
  status: ListingStatus.ACTIVE,
  type: ListingType.PRODUCT,
  title: "Approved product",
  price: "20.00"
};

function disputedTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: transactionId,
    listingId,
    buyerId,
    sellerId,
    listingSnapshot: approvedSnapshot,
    quantity: 1,
    status: TransactionStatus.DISPUTED,
    price: "20.00",
    completedAt: null,
    cancelledAt: null,
    listing: {
      id: listingId,
      sellerId,
      status: ListingStatus.ACTIVE,
      type: ListingType.PRODUCT,
      quantity: 1,
      title: "Current product",
      price: "20.00"
    },
    ...overrides
  };
}

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({
    id: adminId,
    email: "admin@example.test",
    role: Role.ADMIN,
    isBlocked: false,
    tokenVersion: 0,
    lastActiveAt: new Date()
  });
  mocks.userUpdate.mockResolvedValue({});
  mocks.transactionFindFirst.mockResolvedValue(disputedTransaction());
  mocks.transactionUpdateMany.mockResolvedValue({ count: 1 });
  mocks.listingFindUnique.mockResolvedValue({ quantity: 1 });
  mocks.listingUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transactionFindUniqueOrThrow.mockResolvedValue({
    ...disputedTransaction(),
    status: TransactionStatus.COMPLETED
  });
  mocks.notificationCreate.mockResolvedValue({ id: "notification" });
  mocks.auditUserFindUnique.mockResolvedValue({ email: "admin@example.test", role: Role.ADMIN });
  mocks.adminActionLogCreate.mockResolvedValue({ id: "audit" });
  mocks.queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
  mocks.databaseTransaction.mockImplementation(async (operation: (tx: typeof mocks.tx) => unknown) => operation(mocks.tx));

  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function completeDispute() {
  return fetch(`${baseUrl}/api/admin/disputes/${transactionId}/resolve`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ verdict: "COMPLETED", reason: "Evidence confirms a completed handoff" })
  });
}

describe("admin dispute inventory settlement", () => {
  it("atomically marks a product SOLD when resolving its final unit", async () => {
    const response = await completeDispute();

    expect(response.status).toBe(200);
    expect(mocks.listingUpdateMany).toHaveBeenCalledWith({
      where: { id: listingId, quantity: 1 },
      data: { quantity: 0, status: ListingStatus.SOLD }
    });
  });

  it("refuses completion when captured inventory evidence is missing", async () => {
    mocks.transactionFindFirst.mockResolvedValue(disputedTransaction({ listingSnapshot: null }));

    const response = await completeDispute();

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "Reservation inventory evidence is incomplete. Resolve the snapshot before completing this dispute."
    });
    expect(mocks.transactionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.listingUpdateMany).not.toHaveBeenCalled();
  });

  it("normalizes a database inventory constraint without exposing its text", async () => {
    const inventoryConstraint = new Prisma.PrismaClientKnownRequestError("raw dispute trigger detail", {
      code: "P2004",
      clientVersion: "test"
    });
    mocks.listingUpdateMany.mockRejectedValue(inventoryConstraint);

    const response = await completeDispute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ message: "Listing inventory changed while this dispute was being resolved" });
    expect(JSON.stringify(body)).not.toContain("raw dispute trigger detail");
  });
});
