import type { Prisma } from "@prisma/client";

function participantPairKey(firstUserId: string, secondUserId: string) {
  return `messages:pair:${[firstUserId, secondUserId].sort().join(":")}`;
}

/** Serializes account-wide messaging state such as an administrator block. */
export async function lockMessageAccounts(tx: Prisma.TransactionClient, ...userIds: string[]) {
  for (const userId of Array.from(new Set(userIds)).sort()) {
    const key = `messages:account:${userId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

/**
 * Serializes block/unblock decisions with message delivery for a participant
 * pair. Call this before the conversation lock everywhere to avoid deadlocks.
 */
export async function lockMessageParticipants(
  tx: Prisma.TransactionClient,
  firstUserId: string,
  secondUserId: string
) {
  await lockMessageAccounts(tx, firstUserId, secondUserId);
  const key = participantPairKey(firstUserId, secondUserId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/** Serializes manual and automated messages inside one conversation. */
export async function lockConversationMessages(tx: Prisma.TransactionClient, conversationId: string) {
  const key = `messages:conversation:${conversationId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
