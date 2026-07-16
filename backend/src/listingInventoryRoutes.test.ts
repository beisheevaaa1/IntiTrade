import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingCondition, ListingStatus, ListingType, Prisma, Role } from "@prisma/client";
import { signAccessToken } from "./utils/auth.js";

const mocks = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const userUpdate = vi.fn();
  const listingFindUnique = vi.fn();
  const txListingFindUnique = vi.fn();
  const txListingUpdate = vi.fn();
  const txListingUpdateMany = vi.fn();
  const transactionFindMany = vi.fn();
  const queryRaw = vi.fn();
  const databaseTransaction = vi.fn();
  const tx = {
    $queryRaw: queryRaw,
    listing: {
      findUnique: txListingFindUnique,
      update: txListingUpdate,
      updateMany: txListingUpdateMany
    },
    transaction: { findMany: transactionFindMany }
  };
  return {
    userFindUnique,
    userUpdate,
    listingFindUnique,
    txListingFindUnique,
    txListingUpdate,
    txListingUpdateMany,
    transactionFindMany,
    queryRaw,
    databaseTransaction,
    tx
  };
});

vi.mock("./prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    listing: { findUnique: mocks.listingFindUnique },
    category: { findUnique: vi.fn() },
    meetupPoint: { findUnique: vi.fn() },
    $transaction: mocks.databaseTransaction
  }
}));

import { createApp } from "./app.js";

const sellerId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";
const listingId = "33333333-3333-4333-8333-333333333333";
const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });
const adminToken = signAccessToken({ id: adminId, role: Role.ADMIN, tokenVersion: 0 });

function approvedProductSnapshot() {
  return {
    _snapshotVersion: 1,
    _snapshotProvenance: "captured",
    id: listingId,
    status: ListingStatus.ACTIVE,
    type: ListingType.PRODUCT
  };
}

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.userUpdate.mockResolvedValue({});
  mocks.queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
  mocks.databaseTransaction.mockImplementation(async (operation: (tx: typeof mocks.tx) => unknown) => operation(mocks.tx));
  mocks.listingFindUnique.mockResolvedValue({
    id: listingId,
    sellerId,
    type: ListingType.PRODUCT,
    quantity: 5,
    condition: ListingCondition.GOOD,
    images: []
  });
  mocks.txListingFindUnique.mockResolvedValue({
    id: listingId,
    sellerId,
    status: ListingStatus.PENDING,
    rejectionReason: null,
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    type: ListingType.PRODUCT,
    quantity: 5,
    condition: ListingCondition.GOOD
  });
  mocks.transactionFindMany.mockResolvedValue([{
    listingId,
    listingSnapshot: approvedProductSnapshot(),
    quantity: 2
  }]);

  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("listing inventory hold routes", () => {
  it("rejects a seller edit that reduces product quantity below active holds", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });

    const response = await fetch(`${baseUrl}/api/listings/${listingId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${sellerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 1 })
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "Quantity cannot be lower than the 2 item(s) held by active reservations or disputes."
    });
    expect(mocks.txListingUpdate).not.toHaveBeenCalled();
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("rejects admin activation when a pending edit changed the type of held inventory", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: adminId,
      email: "admin@example.test",
      role: Role.ADMIN,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    mocks.txListingFindUnique.mockResolvedValue({
      id: listingId,
      sellerId,
      status: ListingStatus.PENDING,
      rejectionReason: null,
      updatedAt: new Date("2026-07-15T00:00:00.000Z"),
      type: ListingType.SERVICE,
      quantity: 1,
      condition: ListingCondition.NOT_APPLICABLE
    });

    const response = await fetch(`${baseUrl}/api/admin/listings/${listingId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: ListingStatus.ACTIVE })
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "Active reservations or disputes use a different listing type. Resolve them before changing this listing type."
    });
    expect(mocks.txListingUpdateMany).not.toHaveBeenCalled();
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("normalizes a listing trigger constraint without exposing database detail", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const inventoryConstraint = new Prisma.PrismaClientKnownRequestError("raw listing trigger detail", {
      code: "P2004",
      clientVersion: "test"
    });
    mocks.databaseTransaction.mockRejectedValueOnce(inventoryConstraint);

    const response = await fetch(`${baseUrl}/api/listings/${listingId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${sellerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 4 })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ message: "Listing inventory changed while this request was being processed" });
    expect(JSON.stringify(body)).not.toContain("raw listing trigger detail");
  });

  it("normalizes an admin moderation inventory constraint", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: adminId,
      email: "admin@example.test",
      role: Role.ADMIN,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const inventoryConstraint = new Prisma.PrismaClientKnownRequestError("raw admin trigger detail", {
      code: "P2004",
      clientVersion: "test"
    });
    mocks.databaseTransaction.mockRejectedValueOnce(inventoryConstraint);

    const response = await fetch(`${baseUrl}/api/admin/listings/${listingId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: ListingStatus.ACTIVE })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ message: "Listing inventory changed while this request was being processed" });
    expect(JSON.stringify(body)).not.toContain("raw admin trigger detail");
  });
});
