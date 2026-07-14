DO $$
BEGIN
  CREATE TYPE "WantAdStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WantAd" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "maxPrice" DECIMAL(10,2) NOT NULL,
  "status" "WantAdStatus" NOT NULL DEFAULT 'ACTIVE',
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WantAd_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WantAd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WantAd_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WantAd_status_createdAt_idx" ON "WantAd"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WantAd_categoryId_status_idx" ON "WantAd"("categoryId", "status");
CREATE INDEX IF NOT EXISTS "WantAd_userId_idx" ON "WantAd"("userId");
