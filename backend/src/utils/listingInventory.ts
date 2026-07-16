import { ListingStatus, ListingType, Prisma, TransactionStatus } from "@prisma/client";

export const INVENTORY_HOLD_STATUSES = [TransactionStatus.RESERVED, TransactionStatus.DISPUTED];

type ListingInventoryTransition = {
  listingId: string;
  nextType: ListingType;
  nextQuantity: number;
};

export type ListingInventoryConflict = {
  kind: "TYPE" | "QUANTITY";
  message: string;
  heldQuantity: number;
};

/** Maps the PostgreSQL inventory trigger/check violation to a safe API conflict. */
export function isListingInventoryDatabaseConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2004";
  return error instanceof Prisma.PrismaClientUnknownRequestError
    && /PostgresError\s*\{\s*code:\s*"23514"|SQLSTATE\s*23514/i.test(error.message);
}

function snapshotListingType(snapshot: Prisma.JsonValue | null, listingId: string) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  if (
    snapshot._snapshotVersion !== 1
    // `reconstructed` is written only by the one-time migration for an
    // already-open legacy hold. It keeps the pre-existing live-inventory
    // settlement behaviour at cutover. UI evidence remains redacted unless
    // the relationship was actually captured by the new application.
    || (snapshot._snapshotProvenance !== "captured" && snapshot._snapshotProvenance !== "reconstructed")
    || snapshot.status !== "ACTIVE"
    || snapshot.id !== listingId
  ) return null;
  return typeof snapshot.type === "string" && snapshot.type in ListingType
    ? snapshot.type as ListingType
    : null;
}

export function transactionListingType(
  snapshot: Prisma.JsonValue | null,
  listingId: string
) {
  return snapshotListingType(snapshot, listingId);
}

/** All listing inventory writers use the same transaction-scoped lock. */
export async function lockListingInventory(tx: Prisma.TransactionClient, listingId: string) {
  // pg_advisory_xact_lock returns PostgreSQL `void`. `$queryRaw` attempts to
  // deserialize that value and Prisma rejects it; `$executeRaw` retains the
  // same transaction-scoped lock without reading its return value.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${listingId}, 0))`;
}

/**
 * Consume product stock while holding lockListingInventory. The last units and
 * SOLD status are written together so the database never observes an active
 * product with zero stock.
 */
export async function settleProductInventory(
  tx: Prisma.TransactionClient,
  listingId: string,
  quantity: number
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return false;
  const listing = await tx.listing.findUnique({
    where: { id: listingId },
    select: { quantity: true }
  });
  if (!listing || listing.quantity < quantity) return false;

  const finalUnits = listing.quantity === quantity;
  const updated = await tx.listing.updateMany({
    where: { id: listingId, quantity: listing.quantity },
    data: finalUnits
      ? { quantity: 0, status: ListingStatus.SOLD }
      : { quantity: { decrement: quantity } }
  });
  return updated.count === 1;
}

/**
 * Prevent an edit or moderation action from changing the meaning of inventory
 * already promised to buyers. Call this after acquiring lockListingInventory.
 */
export async function listingInventoryConflict(
  tx: Prisma.TransactionClient,
  transition: ListingInventoryTransition
): Promise<ListingInventoryConflict | null> {
  if (transition.nextType === ListingType.PRODUCT && transition.nextQuantity < 1) {
    return {
      kind: "QUANTITY",
      heldQuantity: 0,
      message: "A product listing needs at least one item before it can be submitted or activated."
    };
  }

  const holds = await tx.transaction.findMany({
    where: {
      listingId: transition.listingId,
      status: { in: INVENTORY_HOLD_STATUSES }
    },
    select: {
      listingId: true,
      listingSnapshot: true,
      quantity: true
    }
  });
  if (!holds.length) return null;

  const heldTypes = holds.map((hold) => transactionListingType(hold.listingSnapshot, hold.listingId));
  const heldQuantity = holds.reduce((sum, hold) => sum + hold.quantity, 0);

  if (heldTypes.some((type) => type !== transition.nextType)) {
    return {
      kind: "TYPE",
      heldQuantity,
      message: "Active reservations or disputes use a different listing type. Resolve them before changing this listing type."
    };
  }

  if (transition.nextType === ListingType.PRODUCT && transition.nextQuantity < heldQuantity) {
    return {
      kind: "QUANTITY",
      heldQuantity,
      message: `Quantity cannot be lower than the ${heldQuantity} item(s) held by active reservations or disputes.`
    };
  }

  return null;
}
