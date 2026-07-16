import { ListingStatus, Prisma } from "@prisma/client";

export const listingSnapshotInclude = Prisma.validator<Prisma.ListingInclude>()({
  images: { orderBy: { createdAt: "asc" } },
  category: true,
  meetupPoint: true
});

export type ListingForSnapshot = Prisma.ListingGetPayload<{ include: typeof listingSnapshotInclude }>;

type RelatedListing = {
  id: string;
  sellerId: string;
  status: ListingStatus;
  [key: string]: unknown;
};

type ApprovedSnapshot = Record<string, unknown> & {
  _snapshotVersion: 1;
  _snapshotProvenance: "captured";
  id: string;
  sellerId: string;
  status: "ACTIVE";
  title: string;
  description: string;
  images: unknown[];
};

function isApprovedSnapshot(value: unknown, listing: RelatedListing): value is ApprovedSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return snapshot._snapshotVersion === 1
    && snapshot._snapshotProvenance === "captured"
    && snapshot.id === listing.id
    && snapshot.sellerId === listing.sellerId
    && snapshot.status === ListingStatus.ACTIVE
    && typeof snapshot.title === "string"
    && typeof snapshot.description === "string"
    && Array.isArray(snapshot.images);
}

/**
 * Captures the exact, admin-approved listing representation used by relationship
 * records. The JSON round-trip detaches Prisma Decimal/Date instances so later
 * listing mutations cannot alter the stored value.
 */
export function createApprovedListingSnapshot(listing: ListingForSnapshot): Prisma.InputJsonObject {
  if (listing.status !== ListingStatus.ACTIVE) {
    throw new Error("Only an active listing can be snapshotted");
  }

  return JSON.parse(JSON.stringify({
    _snapshotVersion: 1,
    _snapshotProvenance: "captured",
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price.toString(),
    type: listing.type,
    condition: listing.condition,
    status: ListingStatus.ACTIVE,
    location: listing.location,
    rejectionReason: null,
    viewsCount: listing.viewsCount,
    interestCount: listing.interestCount,
    isNegotiable: listing.isNegotiable,
    showPhone: listing.showPhone,
    meetupPreference: listing.meetupPreference,
    meetupPointId: listing.meetupPointId,
    quantity: listing.quantity,
    isRecurring: listing.isRecurring,
    isbn: listing.isbn,
    author: listing.author,
    edition: listing.edition,
    courseCode: listing.courseCode,
    serviceDuration: listing.serviceDuration,
    pricingUnit: listing.pricingUnit,
    availabilityNote: listing.availabilityNote,
    sellerId: listing.sellerId,
    categoryId: listing.categoryId,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    images: listing.images,
    category: listing.category,
    meetupPoint: listing.meetupPoint
  })) as Prisma.InputJsonObject;
}

function redactedListing(listing: RelatedListing) {
  return {
    id: listing.id,
    title: "Listing unavailable",
    description: "This listing is no longer available.",
    price: null,
    type: null,
    condition: null,
    status: listing.status,
    location: "",
    rejectionReason: null,
    viewsCount: 0,
    interestCount: 0,
    isNegotiable: false,
    showPhone: false,
    meetupPreference: null,
    meetupPointId: null,
    quantity: 0,
    isRecurring: false,
    isbn: null,
    author: null,
    edition: null,
    courseCode: null,
    serviceDuration: null,
    pricingUnit: null,
    availabilityNote: null,
    sellerId: listing.sellerId,
    categoryId: null,
    createdAt: null,
    updatedAt: null,
    images: [],
    category: null,
    meetupPoint: null,
    isSnapshot: false,
    unavailable: true
  };
}

function approvedListingFromSnapshot(listing: RelatedListing, snapshot: unknown) {
  if (!isApprovedSnapshot(snapshot, listing)) return null;
  const {
    _snapshotVersion: _version,
    _snapshotProvenance: _provenance,
    ...approvedListing
  } = snapshot as ApprovedSnapshot;
  return approvedListing;
}

/**
 * Evidence/history views always use the listing version captured when the
 * relationship was created. This remains true if the seller later publishes a
 * different approved revision under the same listing id.
 */
export function presentHistoricalListing<Listing extends RelatedListing>(listing: Listing, snapshot: unknown) {
  const approvedListing = approvedListingFromSnapshot(listing, snapshot);
  if (!approvedListing) return redactedListing(listing);
  return {
    ...approvedListing,
    status: listing.status,
    isSnapshot: true,
    unavailable: listing.status !== ListingStatus.ACTIVE
  };
}

/**
 * Owners/admin code paths can receive the current draft. Everyone else receives
 * the immutable approved copy while the live listing is outside the marketplace.
 * Legacy rows that could not be safely backfilled degrade to a redacted object.
 */
export function presentRelatedListing<Listing extends RelatedListing>(
  listing: Listing,
  snapshot: unknown,
  canViewUnapproved: boolean
) {
  if (listing.status === ListingStatus.ACTIVE || canViewUnapproved) return listing;
  return presentHistoricalListing(listing, snapshot);
}
