BEGIN;

-- Some legacy production databases were created before migration history was
-- fully reconciled. Keep this migration idempotent so both those databases and
-- clean installations converge on the current Prisma schema.
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "EmailVerificationToken"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");

COMMIT;
