import { Prisma, type PrismaClient } from "@prisma/client";

type SnapshotQueryClient = PrismaClient | Prisma.TransactionClient;

/**
 * Finds uploaded media retained by immutable conversation, transaction, or
 * report evidence. These URLs remain references even after the seller replaces
 * the current ListingImage rows during a newly moderated edit.
 */
export async function snapshotMediaReferences(client: SnapshotQueryClient, urls: string[]) {
  if (urls.length === 0) return new Set<string>();

  const rows = await client.$queryRaw<Array<{ url: string }>>(Prisma.sql`
    WITH candidates(url) AS (
      SELECT unnest(ARRAY[${Prisma.join(urls)}]::text[])
    )
    SELECT candidate.url
    FROM candidates AS candidate
    WHERE EXISTS (
      SELECT 1 FROM "Conversation"
      WHERE "listingSnapshot"->>'_snapshotProvenance' = 'captured'
        AND "listingSnapshot" @> jsonb_build_object(
          'images', jsonb_build_array(jsonb_build_object('url', candidate.url))
        )
    ) OR EXISTS (
      SELECT 1 FROM "Transaction"
      WHERE "listingSnapshot"->>'_snapshotProvenance' = 'captured'
        AND "listingSnapshot" @> jsonb_build_object(
          'images', jsonb_build_array(jsonb_build_object('url', candidate.url))
        )
    ) OR EXISTS (
      SELECT 1 FROM "Report"
      WHERE "listingSnapshot"->>'_snapshotProvenance' = 'captured'
        AND "listingSnapshot" @> jsonb_build_object(
          'images', jsonb_build_array(jsonb_build_object('url', candidate.url))
        )
    )
  `);

  return new Set(rows.map((row) => row.url));
}
