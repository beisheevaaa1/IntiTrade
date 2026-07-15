import { ListingStatus, Role } from "@prisma/client";

const listingTransitions: Record<ListingStatus, readonly ListingStatus[]> = {
  PENDING: [ListingStatus.ACTIVE, ListingStatus.REJECTED],
  ACTIVE: [ListingStatus.REJECTED, ListingStatus.ARCHIVED],
  REJECTED: [ListingStatus.PENDING, ListingStatus.ACTIVE],
  SOLD: [ListingStatus.ARCHIVED],
  ARCHIVED: [ListingStatus.ACTIVE]
};

export function canModerateListing(from: ListingStatus, to: ListingStatus) {
  return listingTransitions[from].includes(to);
}

export function canChangeUserBlock(actorId: string, target: { id: string; role: Role; isBlocked: boolean }, nextBlocked: boolean) {
  if (actorId === target.id) return { allowed: false, reason: "SELF_BLOCK" as const };
  if (target.role === Role.ADMIN) return { allowed: false, reason: "ADMIN_TARGET" as const };
  if (target.isBlocked === nextBlocked) return { allowed: false, reason: "NO_CHANGE" as const };
  return { allowed: true, reason: null };
}
