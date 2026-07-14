-- Reconcile fields that were added to schema.prisma and production manually
-- without a checked-in migration. IF NOT EXISTS keeps this safe for the
-- current production database while still making a clean migrate deploy
-- reproduce the complete Prisma schema.

DO $$
BEGIN
  CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "showAcademicProfile" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gpa" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "academicGrades" TEXT,
  ADD COLUMN IF NOT EXISTS "resume" TEXT,
  ADD COLUMN IF NOT EXISTS "projects" TEXT,
  ADD COLUMN IF NOT EXISTS "academicTipShown" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "interestCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "offerStatus" "OfferStatus",
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "otpCode" TEXT;

CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");
