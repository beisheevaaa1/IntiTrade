import http from "node:http";
import { ListingCondition, ListingStatus, ListingType, Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "./utils/auth.js";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  listingFindUnique: vi.fn(),
  listingUpdate: vi.fn(),
  conversationFindUnique: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationUpsert: vi.fn(),
  conversationUpdate: vi.fn(),
  conversationFindMany: vi.fn(),
  userBlockFindMany: vi.fn(),
  transactionFindMany: vi.fn(),
  reportCreate: vi.fn(),
  reportFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  favoriteFindMany: vi.fn()
}));

vi.mock("./prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    listing: { findUnique: mocks.listingFindUnique, update: mocks.listingUpdate },
    conversation: {
      findUnique: mocks.conversationFindUnique,
      findFirst: mocks.conversationFindFirst,
      findMany: mocks.conversationFindMany,
      upsert: mocks.conversationUpsert,
      update: mocks.conversationUpdate
    },
    userBlock: { findMany: mocks.userBlockFindMany },
    transaction: { findMany: mocks.transactionFindMany },
    report: { create: mocks.reportCreate, findMany: mocks.reportFindMany },
    notification: { create: mocks.notificationCreate },
    favorite: { findMany: mocks.favoriteFindMany }
  }
}));

import { createApp } from "./app.js";

const buyerId = "11111111-1111-4111-8111-111111111111";
const sellerId = "22222222-2222-4222-8222-222222222222";
const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const listingId = "33333333-3333-4333-8333-333333333333";
const secondListingId = "44444444-4444-4444-8444-444444444444";
const conversationId = "55555555-5555-4555-8555-555555555555";
const categoryId = "66666666-6666-4666-8666-666666666666";
const token = signAccessToken({ id: buyerId, role: Role.STUDENT, tokenVersion: 0 });
const adminToken = signAccessToken({ id: adminId, role: Role.ADMIN, tokenVersion: 0 });

function activeListing(id = listingId, title = "Approved listing") {
  return {
    id,
    title,
    description: "This is the administrator-approved description.",
    price: { toString: () => "99.00", toJSON: () => "99.00" },
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    status: ListingStatus.ACTIVE,
    location: "Main campus",
    rejectionReason: null,
    viewsCount: 0,
    interestCount: 0,
    isNegotiable: false,
    showPhone: false,
    meetupPreference: null,
    meetupPointId: null,
    quantity: 1,
    isRecurring: false,
    isbn: null,
    author: null,
    edition: null,
    courseCode: null,
    serviceDuration: null,
    pricingUnit: "ITEM",
    availabilityNote: null,
    sellerId,
    categoryId,
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-01T10:00:00.000Z"),
    images: [{
      id: "77777777-7777-4777-8777-777777777777",
      listingId: id,
      url: "/uploads/approved.png",
      createdAt: new Date("2026-07-01T10:00:00.000Z")
    }],
    category: { id: categoryId, name: "Electronics", slug: "electronics", createdAt: new Date("2026-06-01T00:00:00.000Z") },
    meetupPoint: null,
    seller: { allowMessages: true }
  };
}

function conversationResult(
  listing: Omit<ReturnType<typeof activeListing>, "status"> & { status: ListingStatus },
  listingSnapshot: unknown,
  id = conversationId
) {
  const { seller: _listingSeller, ...conversationListing } = listing;
  return {
    id,
    listingId: listing.id,
    listingSnapshot,
    buyerId,
    sellerId,
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-01T10:00:00.000Z"),
    listing: conversationListing,
    buyer: { id: buyerId, name: "Buyer", avatarUrl: null, lastActiveAt: new Date(), showOnlineStatus: true },
    seller: { id: sellerId, name: "Seller", avatarUrl: null, lastActiveAt: new Date(), showOnlineStatus: true },
    messages: []
  };
}

function approvedSnapshot(listing: ReturnType<typeof activeListing>) {
  const { seller: _seller, ...safeListing } = listing;
  return JSON.parse(JSON.stringify({
    _snapshotVersion: 1,
    _snapshotProvenance: "captured",
    ...safeListing,
    price: listing.price.toString()
  }));
}

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({
    id: buyerId,
    role: Role.STUDENT,
    isBlocked: false,
    tokenVersion: 0,
    lastActiveAt: new Date()
  });
  mocks.userBlockFindMany.mockResolvedValue([]);
  mocks.transactionFindMany.mockResolvedValue([]);
  mocks.listingUpdate.mockResolvedValue({});
  mocks.notificationCreate.mockResolvedValue({});
  mocks.favoriteFindMany.mockResolvedValue([]);
  mocks.conversationFindMany.mockResolvedValue([]);

  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function authHeaders() {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("durable moderation snapshots in relationship routes", () => {
  it("does not expose a seller's pending conversation edits to the buyer", async () => {
    const approved = activeListing();
    const pending = {
      ...approved,
      status: ListingStatus.PENDING,
      title: "UNREVIEWED SECRET TITLE",
      description: "UNREVIEWED SECRET DESCRIPTION",
      images: [{ ...approved.images[0], url: "/uploads/unreviewed-secret.png" }]
    };
    mocks.conversationFindMany.mockResolvedValue([
      conversationResult(pending, approvedSnapshot(approved))
    ]);

    const response = await fetch(`${baseUrl}/api/conversations`, { headers: authHeaders() });
    const body = await response.json() as { conversations: Array<{ listing: Record<string, unknown> }> };

    expect(response.status).toBe(200);
    expect(body.conversations[0].listing).toMatchObject({
      title: "Approved listing",
      description: "This is the administrator-approved description.",
      isSnapshot: true,
      unavailable: true
    });
    expect(JSON.stringify(body)).not.toContain("UNREVIEWED");
    expect(JSON.stringify(body)).not.toContain("unreviewed-secret.png");
    expect(body.conversations[0]).not.toHaveProperty("listingSnapshot");
  });

  it("stores the approved listing when a conversation is created", async () => {
    const listing = activeListing();
    mocks.listingFindUnique.mockResolvedValue(listing);
    mocks.conversationFindUnique.mockResolvedValue(null);
    mocks.conversationUpsert.mockImplementation(async (args) => conversationResult(listing, args.create.listingSnapshot));

    const response = await fetch(`${baseUrl}/api/conversations`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ listingId })
    });

    expect(response.status).toBe(201);
    expect(mocks.conversationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        listingId,
        buyerId,
        sellerId,
        listingSnapshot: expect.objectContaining({
          _snapshotVersion: 1,
          id: listingId,
          status: ListingStatus.ACTIVE,
          title: "Approved listing"
        })
      })
    }));
    const snapshot = mocks.conversationUpsert.mock.calls[0][0].create.listingSnapshot;
    expect(snapshot).not.toHaveProperty("seller");
  });

  it("opens a separate listing conversation without relabelling the original messages", async () => {
    const listing = activeListing(secondListingId, "Approved second listing");
    mocks.conversationFindFirst.mockResolvedValue({ id: conversationId, listingId, buyerId, sellerId });
    mocks.listingFindUnique.mockResolvedValue(listing);
    mocks.conversationFindUnique.mockResolvedValue(null);
    mocks.conversationUpsert.mockImplementation(async (args) => conversationResult(listing, args.create.listingSnapshot));

    const response = await fetch(`${baseUrl}/api/conversations/${conversationId}/listing`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ listingId: secondListingId })
    });

    expect(response.status).toBe(200);
    expect(mocks.conversationUpdate).not.toHaveBeenCalled();
    expect(mocks.conversationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        listingId_buyerId_sellerId: {
          listingId: secondListingId,
          buyerId,
          sellerId
        }
      },
      update: {},
      create: expect.objectContaining({
        listingId: secondListingId,
        buyerId,
        sellerId,
        listingSnapshot: expect.objectContaining({
          _snapshotVersion: 1,
          id: secondListingId,
          title: "Approved second listing"
        })
      })
    }));
  });

  it("reuses the existing unique conversation for the selected listing", async () => {
    const targetConversationId = "99999999-9999-4999-8999-999999999999";
    const listing = activeListing(secondListingId, "Approved second listing");
    const snapshot = approvedSnapshot(listing);
    const existingTarget = conversationResult(listing, snapshot, targetConversationId);
    mocks.conversationFindFirst.mockResolvedValue({ id: conversationId, listingId, buyerId, sellerId });
    mocks.listingFindUnique.mockResolvedValue(listing);
    mocks.conversationFindUnique.mockResolvedValue({ id: targetConversationId });
    mocks.conversationUpsert.mockResolvedValue(existingTarget);

    const response = await fetch(`${baseUrl}/api/conversations/${conversationId}/listing`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ listingId: secondListingId })
    });
    const body = await response.json() as { conversation: { id: string } };

    expect(response.status).toBe(200);
    expect(body.conversation.id).toBe(targetConversationId);
    expect(mocks.conversationUpdate).not.toHaveBeenCalled();
    expect(mocks.listingUpdate).not.toHaveBeenCalled();
    expect(mocks.conversationUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });

  it("stores the approved listing on a report and rejects non-active report targets", async () => {
    const listing = activeListing();
    const reapprovedListing = {
      ...listing,
      title: "A different later-approved title",
      description: "A different later-approved description."
    };
    mocks.listingFindUnique.mockResolvedValueOnce(listing);
    mocks.reportCreate.mockImplementation(async (args) => ({
      id: "88888888-8888-4888-8888-888888888888",
      status: "OPEN",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data,
      listing: reapprovedListing
    }));

    const created = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ listingId, reason: "Misleading details" })
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { report: { listing: { title: string; description: string } } };
    expect(createdBody.report.listing).toMatchObject({
      title: "Approved listing",
      description: "This is the administrator-approved description."
    });
    expect(JSON.stringify(createdBody)).not.toContain("different later-approved");
    expect(mocks.reportCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        listingId,
        reporterId: buyerId,
        listingSnapshot: expect.objectContaining({
          _snapshotVersion: 1,
          id: listingId,
          status: ListingStatus.ACTIVE
        })
      })
    }));

    mocks.listingFindUnique.mockResolvedValueOnce({ ...listing, status: ListingStatus.PENDING });
    const rejected = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ listingId, reason: "Misleading details" })
    });
    expect(rejected.status).toBe(404);
    expect(mocks.reportCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps the admin report queue on the captured evidence revision", async () => {
    const approved = activeListing();
    const current = {
      ...approved,
      title: "UNRELATED NEW ACTIVE REVISION",
      description: "This content was approved after the report was filed.",
      seller: { id: sellerId, name: "Seller", email: "seller@example.test" }
    };
    mocks.userFindUnique.mockResolvedValueOnce({
      id: adminId,
      role: Role.ADMIN,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    mocks.reportFindMany.mockResolvedValue([{
      id: "88888888-8888-4888-8888-888888888888",
      reason: "Misleading details",
      details: null,
      status: "OPEN",
      reporterId: buyerId,
      listingId,
      listingSnapshot: approvedSnapshot(approved),
      createdAt: new Date(),
      updatedAt: new Date(),
      reporter: { id: buyerId, name: "Buyer", email: "buyer@example.test" },
      listing: current
    }]);

    const response = await fetch(`${baseUrl}/api/admin/reports`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const body = await response.json() as { reports: Array<{ listing: Record<string, unknown> }> };

    expect(response.status).toBe(200);
    expect(body.reports[0].listing).toMatchObject({
      title: "Approved listing",
      description: "This is the administrator-approved description.",
      isSnapshot: true,
      seller: { id: sellerId, email: "seller@example.test" }
    });
    expect(body.reports[0]).not.toHaveProperty("listingSnapshot");
    expect(JSON.stringify(body)).not.toContain("UNRELATED NEW ACTIVE REVISION");
  });

  it("keeps admin transaction history on the captured revision", async () => {
    const approved = activeListing();
    mocks.userFindUnique.mockResolvedValueOnce({
      id: adminId,
      role: Role.ADMIN,
      isBlocked: false,
      tokenVersion: 0,
      lastActiveAt: new Date()
    });
    mocks.transactionFindMany.mockResolvedValue([{
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      listingId,
      listingSnapshot: approvedSnapshot(approved),
      buyerId,
      sellerId,
      price: "99.00",
      quantity: 1,
      status: "COMPLETED",
      meetupPointId: null,
      otpCode: null,
      completedAt: new Date(),
      cancelledAt: null,
      disputeReason: null,
      createdAt: new Date(),
      listing: {
        id: listingId,
        sellerId,
        status: ListingStatus.ACTIVE,
        title: "UNRELATED NEW ACTIVE REVISION",
        price: "120.00"
      },
      buyer: { id: buyerId, name: "Buyer", email: "buyer@example.test" },
      seller: { id: sellerId, name: "Seller", email: "seller@example.test" }
    }]);

    const response = await fetch(`${baseUrl}/api/admin/transactions`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const body = await response.json() as { transactions: Array<{ listing: Record<string, unknown> }> };

    expect(response.status).toBe(200);
    expect(body.transactions[0].listing).toMatchObject({
      title: "Approved listing",
      description: "This is the administrator-approved description.",
      price: "99.00",
      isSnapshot: true
    });
    expect(body.transactions[0]).not.toHaveProperty("listingSnapshot");
    expect(JSON.stringify(body)).not.toContain("UNRELATED NEW ACTIVE REVISION");
  });

  it("returns a redacted removable favorite when its listing is no longer active", async () => {
    const pending = {
      ...activeListing(),
      status: ListingStatus.PENDING,
      title: "UNREVIEWED FAVORITE TITLE",
      description: "UNREVIEWED FAVORITE DESCRIPTION"
    };
    mocks.favoriteFindMany.mockResolvedValue([{
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      userId: buyerId,
      listingId,
      createdAt: new Date(),
      listing: pending
    }]);

    const response = await fetch(`${baseUrl}/api/favorites`, { headers: authHeaders() });
    const body = await response.json() as {
      favorites: Array<{ listingId: string; listing: Record<string, unknown> }>;
    };

    expect(response.status).toBe(200);
    expect(mocks.favoriteFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: buyerId }
    }));
    expect(body.favorites[0]).toMatchObject({
      listingId,
      listing: {
        id: listingId,
        title: "Listing unavailable",
        unavailable: true,
        status: ListingStatus.PENDING
      }
    });
    expect(JSON.stringify(body)).not.toContain("UNREVIEWED");
  });
});
