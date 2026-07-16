import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingStatus, ListingType, Prisma, Role, TransactionStatus } from "@prisma/client";
import { signAccessToken } from "./utils/auth.js";

const mocks = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const userUpdate = vi.fn();
  const listingFindUnique = vi.fn();
  const listingFindUniqueOrThrow = vi.fn();
  const listingUpdate = vi.fn();
  const listingUpdateMany = vi.fn();
  const meetupPointFindUnique = vi.fn();
  const transactionFindMany = vi.fn();
  const transactionAggregate = vi.fn();
  const transactionCreate = vi.fn();
  const transactionUpdate = vi.fn();
  const transactionUpdateMany = vi.fn();
  const transactionFindUnique = vi.fn();
  const transactionFindUniqueOrThrow = vi.fn();
  const notificationCreate = vi.fn();
  const messageFindUnique = vi.fn();
  const messageUpdateMany = vi.fn();
  const messageFindUniqueOrThrow = vi.fn();
  const reviewCreate = vi.fn();
  const queryRaw = vi.fn();
  const databaseTransaction = vi.fn();

  const tx = {
    $queryRaw: queryRaw,
    $executeRaw: queryRaw,
    listing: {
      findUnique: listingFindUnique,
      findUniqueOrThrow: listingFindUniqueOrThrow,
      update: listingUpdate,
      updateMany: listingUpdateMany
    },
    meetupPoint: { findUnique: meetupPointFindUnique },
    transaction: {
      findMany: transactionFindMany,
      aggregate: transactionAggregate,
      create: transactionCreate,
      update: transactionUpdate,
      updateMany: transactionUpdateMany,
      findUniqueOrThrow: transactionFindUniqueOrThrow
    },
    message: { updateMany: messageUpdateMany, findUniqueOrThrow: messageFindUniqueOrThrow },
    notification: { create: notificationCreate },
    review: { create: reviewCreate }
  };

  return {
    userFindUnique,
    userUpdate,
    listingFindUnique,
    listingFindUniqueOrThrow,
    listingUpdate,
    listingUpdateMany,
    meetupPointFindUnique,
    transactionFindMany,
    transactionAggregate,
    transactionCreate,
    transactionUpdate,
    transactionUpdateMany,
    transactionFindUnique,
    transactionFindUniqueOrThrow,
    notificationCreate,
    messageFindUnique,
    messageUpdateMany,
    messageFindUniqueOrThrow,
    reviewCreate,
    queryRaw,
    databaseTransaction,
    tx
  };
});

vi.mock("./prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    transaction: {
      findMany: mocks.transactionFindMany,
      findUnique: mocks.transactionFindUnique
    },
    notification: { create: mocks.notificationCreate },
    message: { findUnique: mocks.messageFindUnique, updateMany: mocks.messageUpdateMany },
    review: { create: mocks.reviewCreate, findMany: vi.fn(), aggregate: vi.fn() },
    $transaction: mocks.databaseTransaction
  }
}));

import { createApp } from "./app.js";

const buyerId = "11111111-1111-4111-8111-111111111111";
const sellerId = "22222222-2222-4222-8222-222222222222";
const listingId = "33333333-3333-4333-8333-333333333333";
const transactionId = "44444444-4444-4444-8444-444444444444";
const messageId = "55555555-5555-4555-8555-555555555555";
const token = signAccessToken({ id: buyerId, role: Role.STUDENT, tokenVersion: 0 });

const listing = {
  id: listingId,
  sellerId,
  status: ListingStatus.ACTIVE,
  type: ListingType.PRODUCT,
  price: "20.00",
  quantity: 5,
  title: "Approved title",
  description: "Approved description",
  images: [],
  category: null,
  meetupPoint: null
};

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    id: transactionId,
    listingId,
    buyerId,
    sellerId,
    listingSnapshot: null,
    price: "20.00",
    quantity: 2,
    status: TransactionStatus.RESERVED,
    meetupPointId: null,
    otpCode: "123456",
    completedAt: null,
    cancelledAt: null,
    disputeReason: null,
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    listing: { ...listing, images: [], category: null, meetupPoint: null },
    buyer: { id: buyerId, name: "Buyer", avatarUrl: null },
    seller: { id: sellerId, name: "Seller", avatarUrl: null, sellerType: "CASUAL" },
    meetupPoint: null,
    review: null,
    ...overrides
  };
}

let server: http.Server;
let baseUrl: string;

async function post(path: string, body: object) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({
    id: buyerId,
    role: Role.STUDENT,
    isBlocked: false,
    tokenVersion: 0,
    lastActiveAt: new Date()
  });
  mocks.listingFindUnique.mockResolvedValue(listing);
  mocks.listingFindUniqueOrThrow.mockResolvedValue({ quantity: listing.quantity });
  mocks.meetupPointFindUnique.mockResolvedValue({ id: "meetup", isActive: true });
  mocks.transactionFindMany.mockResolvedValue([]);
  mocks.transactionAggregate.mockResolvedValue({ _sum: { quantity: 0 } });
  mocks.transactionCreate.mockResolvedValue(reservation());
  mocks.listingUpdateMany.mockResolvedValue({ count: 1 });
  mocks.listingUpdate.mockResolvedValue({});
  mocks.notificationCreate.mockResolvedValue({ id: "notification" });
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

describe("transaction reservation invariants", () => {
  it("stores the approved listing snapshot when creating a reservation", async () => {
    const response = await post("/api/transactions", { listingId, quantity: 2 });

    expect(response.status).toBe(201);
    expect(mocks.transactionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        listingId,
        listingSnapshot: expect.objectContaining({
          _snapshotVersion: 1,
          id: listingId,
          title: "Approved title",
          description: "Approved description"
        })
      })
    }));
  });

  it("counts RESERVED and DISPUTED transactions as inventory holds", async () => {
    mocks.transactionAggregate.mockResolvedValue({ _sum: { quantity: 4 } });

    const response = await post("/api/transactions", { listingId, quantity: 2 });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: "Only 1 item(s) are available" });
    expect(mocks.transactionAggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        listingId,
        status: { in: [TransactionStatus.RESERVED, TransactionStatus.DISPUTED] }
      }
    }));
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
  });

  it("makes two concurrent identical reservation requests create only one transaction", async () => {
    const rows: ReturnType<typeof reservation>[] = [];
    let transactionQueue = Promise.resolve();
    mocks.databaseTransaction.mockImplementation((operation: (tx: typeof mocks.tx) => unknown) => {
      const result = transactionQueue.then(() => operation(mocks.tx));
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    });
    mocks.transactionFindMany.mockImplementation(async () => [...rows]);
    mocks.transactionCreate.mockImplementation(async () => {
      const created = reservation();
      rows.push(created);
      return created;
    });

    const responses = await Promise.all([
      post("/api/transactions", { listingId, quantity: 2 }),
      post("/api/transactions", { listingId, quantity: 2 })
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(bodies.map((body) => body.transaction.id)).toEqual([transactionId, transactionId]);
    expect(mocks.transactionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.notificationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
  });

  it("returns a clean conflict instead of changing an existing active reservation", async () => {
    mocks.transactionFindMany.mockResolvedValue([reservation({ quantity: 1 })]);

    const response = await post("/api/transactions", { listingId, quantity: 2 });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: "You already have an active reservation for this listing" });
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
  });

  it("returns an identical existing reservation even when the live listing moved back to moderation", async () => {
    mocks.listingFindUnique.mockResolvedValue({ ...listing, status: ListingStatus.PENDING });
    mocks.transactionFindMany.mockResolvedValue([reservation()]);

    const response = await post("/api/transactions", { listingId, quantity: 2 });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ created: false, transaction: { id: transactionId } });
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it("rejects an inactive meetup point before a foreign-key write", async () => {
    mocks.meetupPointFindUnique.mockResolvedValue(null);
    const meetupPointId = "66666666-6666-4666-8666-666666666666";

    const response = await post("/api/transactions", { listingId, quantity: 1, meetupPointId });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "Meetup point is not available" });
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
  });

  it("retries a serialization conflict and then completes the reservation", async () => {
    const serializationConflict = new Prisma.PrismaClientKnownRequestError("serialization conflict", {
      code: "P2034",
      clientVersion: "test"
    });
    mocks.databaseTransaction
      .mockRejectedValueOnce(serializationConflict)
      .mockImplementationOnce(async (operation: (tx: typeof mocks.tx) => unknown) => operation(mocks.tx));

    const response = await post("/api/transactions", { listingId, quantity: 2 });

    expect(response.status).toBe(201);
    expect(mocks.databaseTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.transactionCreate).toHaveBeenCalledTimes(1);
  });

  it("normalizes a known foreign-key race to a non-500 response", async () => {
    const foreignKeyRace = new Prisma.PrismaClientKnownRequestError("foreign key constraint", {
      code: "P2003",
      clientVersion: "test"
    });
    mocks.transactionCreate.mockRejectedValue(foreignKeyRace);

    const response = await post("/api/transactions", { listingId, quantity: 2 });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "A referenced listing, account, or meetup point is no longer available"
    });
  });

  it("normalizes an old-writer active-reservation race to a clean conflict", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError("unique constraint", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: "Transaction_one_active_reservation_per_buyer_listing" }
    });
    mocks.transactionCreate.mockRejectedValue(duplicate);

    const response = await post("/api/transactions", { listingId, quantity: 2 });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "An active reservation already exists for this buyer and listing"
    });
  });

  it("normalizes a database inventory constraint to a safe conflict", async () => {
    const inventoryConstraint = new Prisma.PrismaClientKnownRequestError("raw database inventory detail", {
      code: "P2004",
      clientVersion: "test"
    });
    mocks.transactionCreate.mockRejectedValue(inventoryConstraint);

    const response = await post("/api/transactions", { listingId, quantity: 2 });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ message: "The inventory changed while this request was being processed" });
    expect(JSON.stringify(body)).not.toContain("raw database inventory detail");
  });
});

describe("transaction listing snapshots", () => {
  const approvedSnapshot = {
    _snapshotVersion: 1,
    _snapshotProvenance: "captured",
    ...listing,
    status: ListingStatus.ACTIVE,
    title: "Approved title",
    description: "Approved description",
    images: [{ id: "approved-image", url: "/uploads/approved.png" }]
  };
  const pendingLiveListing = {
    ...listing,
    status: ListingStatus.PENDING,
    title: "Unapproved edited title",
    description: "Unapproved edited description",
    images: [{ id: "draft-image", url: "/uploads/draft.png" }]
  };

  it("shows both parties the captured evidence instead of a live pending edit", async () => {
    mocks.transactionFindMany.mockResolvedValue([
      reservation({ listingSnapshot: approvedSnapshot, listing: pendingLiveListing })
    ]);

    const buyerResponse = await fetch(`${baseUrl}/api/transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const buyerBody = await buyerResponse.json();

    expect(buyerResponse.status).toBe(200);
    expect(buyerBody.transactions[0].listing).toMatchObject({
      title: "Approved title",
      description: "Approved description",
      status: ListingStatus.PENDING,
      isSnapshot: true,
      unavailable: true
    });
    expect(buyerBody.transactions[0].listing.images[0].url).toBe("/uploads/approved.png");

    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });
    const sellerResponse = await fetch(`${baseUrl}/api/transactions`, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    const sellerBody = await sellerResponse.json();

    expect(sellerResponse.status).toBe(200);
    expect(sellerBody.transactions[0].listing).toMatchObject({
      title: "Approved title",
      description: "Approved description",
      status: ListingStatus.PENDING,
      isSnapshot: true,
      unavailable: true
    });
    expect(sellerBody.transactions[0].listing.images[0].url).toBe("/uploads/approved.png");
    expect(JSON.stringify(sellerBody)).not.toContain("Unapproved edited");
  });

  it("keeps the transaction on its captured revision after a newer revision is active", async () => {
    mocks.transactionFindMany.mockResolvedValue([
      reservation({
        listingSnapshot: approvedSnapshot,
        listing: {
          ...listing,
          status: ListingStatus.ACTIVE,
          title: "Later approved revision",
          description: "Later approved description",
          images: [{ id: "later-image", url: "/uploads/later.png" }]
        }
      })
    ]);

    const response = await fetch(`${baseUrl}/api/transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.transactions[0].listing).toMatchObject({
      title: "Approved title",
      description: "Approved description",
      status: ListingStatus.ACTIVE,
      isSnapshot: true,
      unavailable: false
    });
    expect(body.transactions[0].listing.images[0].url).toBe("/uploads/approved.png");
    expect(JSON.stringify(body)).not.toContain("Later approved");
  });

  it("settles product inventory from the approved snapshot after the live listing type changes", async () => {
    const approvedProductSnapshot = {
      ...approvedSnapshot,
      type: ListingType.PRODUCT
    };
    const changedLiveListing = { ...listing, type: ListingType.SERVICE, quantity: 5 };
    const existing = reservation({ listingSnapshot: approvedProductSnapshot, listing: changedLiveListing });
    mocks.transactionFindUnique.mockResolvedValue(existing);
    mocks.transactionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.listingFindUniqueOrThrow.mockResolvedValue({ quantity: 3 });
    mocks.transactionFindUniqueOrThrow.mockResolvedValue({ ...existing, status: TransactionStatus.COMPLETED });

    const response = await fetch(`${baseUrl}/api/transactions/${transactionId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", otpCode: "123456" })
    });

    expect(response.status).toBe(403);

    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });
    const sellerResponse = await fetch(`${baseUrl}/api/transactions/${transactionId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${sellerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", otpCode: "123456" })
    });

    expect(sellerResponse.status).toBe(200);
    expect(mocks.listingUpdateMany).toHaveBeenCalledWith({
      where: { id: listingId, quantity: 5 },
      data: { quantity: { decrement: 2 } }
    });
  });

  it("atomically marks a product SOLD when completing its final units", async () => {
    const existing = reservation({ listingSnapshot: approvedSnapshot, quantity: 2 });
    mocks.transactionFindUnique.mockResolvedValue(existing);
    mocks.transactionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.listingFindUnique.mockResolvedValue({ quantity: 2 });
    mocks.transactionFindUniqueOrThrow.mockResolvedValue({ ...existing, status: TransactionStatus.COMPLETED });
    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });

    const response = await fetch(`${baseUrl}/api/transactions/${transactionId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${sellerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", otpCode: "123456" })
    });

    expect(response.status).toBe(200);
    expect(mocks.listingUpdateMany).toHaveBeenCalledWith({
      where: { id: listingId, quantity: 2 },
      data: { quantity: 0, status: ListingStatus.SOLD }
    });
    expect(mocks.listingUpdate).not.toHaveBeenCalled();
  });

  it("refuses completion without captured inventory evidence", async () => {
    const existing = reservation({ listingSnapshot: null });
    mocks.transactionFindUnique.mockResolvedValue(existing);
    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });

    const response = await fetch(`${baseUrl}/api/transactions/${transactionId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${sellerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", otpCode: "123456" })
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "Reservation inventory evidence is incomplete. Ask an administrator to resolve it."
    });
    expect(mocks.transactionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.listingUpdateMany).not.toHaveBeenCalled();
  });

  it("normalizes a completion-time database inventory constraint", async () => {
    const existing = reservation({ listingSnapshot: approvedSnapshot });
    const inventoryConstraint = new Prisma.PrismaClientKnownRequestError("raw trigger message", {
      code: "P2004",
      clientVersion: "test"
    });
    mocks.transactionFindUnique.mockResolvedValue(existing);
    mocks.transactionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.listingUpdateMany.mockRejectedValue(inventoryConstraint);
    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });

    const response = await fetch(`${baseUrl}/api/transactions/${transactionId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${sellerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", otpCode: "123456" })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ message: "The inventory changed while this request was being processed" });
    expect(JSON.stringify(body)).not.toContain("raw trigger message");
  });

  it("does not decrement product stock for a captured service booking", async () => {
    const approvedServiceSnapshot = {
      ...approvedSnapshot,
      type: ListingType.SERVICE
    };
    const changedLiveListing = { ...listing, type: ListingType.PRODUCT, quantity: 5 };
    const existing = reservation({ listingSnapshot: approvedServiceSnapshot, listing: changedLiveListing });
    mocks.transactionFindUnique.mockResolvedValue(existing);
    mocks.transactionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transactionFindUniqueOrThrow.mockResolvedValue({ ...existing, status: TransactionStatus.COMPLETED });
    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });

    const response = await fetch(`${baseUrl}/api/transactions/${transactionId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${sellerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", otpCode: "123456" })
    });

    expect(response.status).toBe(200);
    expect(mocks.listingUpdateMany).not.toHaveBeenCalled();
  });
});

describe("offer transaction selection", () => {
  it("does not accept an offer when legacy data has multiple active reservations", async () => {
    mocks.messageFindUnique.mockResolvedValue({
      id: messageId,
      senderId: buyerId,
      offerAmount: "18.00",
      offerStatus: "PENDING",
      conversation: { listingId, buyerId, sellerId }
    });
    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });
    mocks.transactionFindMany.mockResolvedValue([
      reservation(),
      reservation({ id: "77777777-7777-4777-8777-777777777777" })
    ]);

    const response = await fetch(`${baseUrl}/api/transactions/messages/${messageId}/accept-offer`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` }
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: "Multiple active reservations exist. Resolve them before accepting an offer." });
    expect(mocks.messageUpdateMany).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
  });

  it("keeps a disputed transaction locked while an offer remains pending", async () => {
    mocks.messageFindUnique.mockResolvedValue({
      id: messageId,
      senderId: buyerId,
      offerAmount: "18.00",
      offerStatus: "PENDING",
      conversation: { listingId, buyerId, sellerId }
    });
    mocks.userFindUnique.mockResolvedValue({
      id: sellerId,
      role: Role.STUDENT,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    const sellerToken = signAccessToken({ id: sellerId, role: Role.STUDENT, tokenVersion: 0 });
    mocks.transactionFindMany.mockResolvedValue([reservation({ status: TransactionStatus.DISPUTED })]);

    const response = await fetch(`${baseUrl}/api/transactions/messages/${messageId}/accept-offer`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` }
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: "Resolve the disputed transaction before accepting an offer." });
    expect(mocks.messageUpdateMany).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
  });
});
