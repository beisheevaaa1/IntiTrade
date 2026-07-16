import { ListingCondition, ListingStatus, ListingType, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  createApprovedListingSnapshot,
  type ListingForSnapshot,
  presentHistoricalListing,
  presentRelatedListing
} from "./utils/listingSnapshot.js";

const listingId = "11111111-1111-4111-8111-111111111111";
const sellerId = "22222222-2222-4222-8222-222222222222";

function approvedListing(): ListingForSnapshot {
  return {
    id: listingId,
    title: "Approved calculator",
    description: "The description an administrator reviewed.",
    price: new Prisma.Decimal("45.50"),
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    status: ListingStatus.ACTIVE,
    location: "Main campus",
    rejectionReason: null,
    viewsCount: 5,
    interestCount: 2,
    isNegotiable: true,
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
    categoryId: "33333333-3333-4333-8333-333333333333",
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-01T11:00:00.000Z"),
    images: [{
      id: "44444444-4444-4444-8444-444444444444",
      listingId,
      url: "/uploads/approved.png",
      createdAt: new Date("2026-07-01T10:00:00.000Z")
    }],
    category: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Electronics",
      slug: "electronics",
      createdAt: new Date("2026-06-01T00:00:00.000Z")
    },
    meetupPoint: null
  };
}

describe("approved listing relationship snapshots", () => {
  it("returns approved content instead of later pending edits to a non-owner", () => {
    const approved = approvedListing();
    const snapshot = createApprovedListingSnapshot(approved);
    const pending = {
      ...approved,
      status: ListingStatus.PENDING,
      title: "UNREVIEWED SECRET TITLE",
      description: "UNREVIEWED SECRET DESCRIPTION",
      images: [{ ...approved.images[0], url: "/uploads/unreviewed-secret.png" }]
    };

    const presented = presentRelatedListing(pending, snapshot, false);

    expect(presented).toMatchObject({
      id: listingId,
      title: "Approved calculator",
      description: "The description an administrator reviewed.",
      status: ListingStatus.PENDING,
      isSnapshot: true,
      unavailable: true
    });
    expect(presented.images).toEqual([expect.objectContaining({ url: "/uploads/approved.png" })]);
    expect(JSON.stringify(presented)).not.toContain("UNREVIEWED");
    expect(JSON.stringify(presented)).not.toContain("unreviewed-secret.png");
  });

  it("allows the seller to preview their own pending version", () => {
    const approved = approvedListing();
    const snapshot = createApprovedListingSnapshot(approved);
    const pending = { ...approved, status: ListingStatus.PENDING, title: "Seller draft" };

    expect(presentRelatedListing(pending, snapshot, true)).toBe(pending);
  });

  it("keeps historical evidence on the captured revision after a newer revision becomes active", () => {
    const approved = approvedListing();
    const snapshot = createApprovedListingSnapshot(approved);
    const newerActiveRevision = {
      ...approved,
      title: "Newly re-approved title",
      description: "A different description approved at a later date.",
      images: [{ ...approved.images[0], url: "/uploads/new-approved-revision.png" }]
    };

    const presented = presentHistoricalListing(newerActiveRevision, snapshot);

    expect(presented).toMatchObject({
      title: "Approved calculator",
      description: "The description an administrator reviewed.",
      isSnapshot: true,
      unavailable: false
    });
    expect(JSON.stringify(presented)).not.toContain("Newly re-approved");
    expect(JSON.stringify(presented)).not.toContain("new-approved-revision.png");
  });

  it("redacts legacy non-active relationships that have no provably approved copy", () => {
    const pending = {
      ...approvedListing(),
      status: ListingStatus.REJECTED,
      title: "UNREVIEWED SECRET TITLE",
      description: "UNREVIEWED SECRET DESCRIPTION"
    };

    const presented = presentRelatedListing(pending, null, false);

    expect(presented).toMatchObject({
      id: listingId,
      title: "Listing unavailable",
      description: "This listing is no longer available.",
      status: ListingStatus.REJECTED,
      isSnapshot: false,
      unavailable: true,
      images: []
    });
    expect(JSON.stringify(presented)).not.toContain("UNREVIEWED");
  });

  it("redacts reconstructed legacy content instead of presenting it as exact evidence", () => {
    const active = approvedListing();
    const reconstructed = {
      ...createApprovedListingSnapshot(active),
      _snapshotProvenance: "reconstructed"
    };

    const presented = presentHistoricalListing(active, reconstructed);

    expect(presented).toMatchObject({
      id: listingId,
      title: "Listing unavailable",
      isSnapshot: false,
      unavailable: true
    });
    expect(JSON.stringify(presented)).not.toContain("Approved calculator");
  });

  it("refuses to persist a snapshot from a non-active listing", () => {
    const pending = { ...approvedListing(), status: ListingStatus.PENDING };
    expect(() => createApprovedListingSnapshot(pending)).toThrow("Only an active listing can be snapshotted");
  });
});
