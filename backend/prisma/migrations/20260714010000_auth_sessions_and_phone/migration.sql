-- Revokeable access tokens and opt-in seller phone visibility.
-- Existing accounts remain valid without a phone; it is required by the API
-- only for new registrations so this migration is safe on production data.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "phone" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "showPhone" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "UserBlock"
  ADD COLUMN IF NOT EXISTS "reason" TEXT;
