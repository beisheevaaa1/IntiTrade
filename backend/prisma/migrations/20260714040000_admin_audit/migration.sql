BEGIN;

-- Preserve audit history if an administrator account is removed and add
-- immutable actor/request snapshots for accountable moderation.
ALTER TABLE "AdminActionLog" DROP CONSTRAINT "AdminActionLog_adminId_fkey";
ALTER TABLE "AdminActionLog" ALTER COLUMN "adminId" DROP NOT NULL;
ALTER TABLE "AdminActionLog"
  ADD COLUMN "actorEmail" TEXT,
  ADD COLUMN "actorRole" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB,
  ADD COLUMN "metadata" JSONB;

UPDATE "AdminActionLog" AS log
SET "actorEmail" = admin."email", "actorRole" = admin."role"::TEXT
FROM "User" AS admin
WHERE admin."id" = log."adminId";

ALTER TABLE "AdminActionLog"
  ADD CONSTRAINT "AdminActionLog_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");
CREATE INDEX "AdminActionLog_action_createdAt_idx" ON "AdminActionLog"("action", "createdAt");
CREATE INDEX "AdminActionLog_entityType_entityId_createdAt_idx" ON "AdminActionLog"("entityType", "entityId", "createdAt");

COMMIT;
