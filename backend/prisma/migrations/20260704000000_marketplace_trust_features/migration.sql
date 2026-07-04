-- Seller identity, transaction lifecycle, ratings, meetups, announcements, and privacy.
CREATE TYPE "SellerType" AS ENUM ('CASUAL', 'SHOP', 'SERVICE_PROVIDER');
CREATE TYPE "TransactionStatus" AS ENUM ('RESERVED', 'COMPLETED', 'CANCELLED', 'DISPUTED');
CREATE TYPE "AnnouncementStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED');
ALTER TYPE "ListingType" ADD VALUE 'COURSE';

ALTER TABLE "User"
  ADD COLUMN "sellerType" "SellerType" NOT NULL DEFAULT 'CASUAL',
  ADD COLUMN "showEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showCampusArea" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowMessages" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Listing"
  ADD COLUMN "meetupPointId" TEXT,
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isbn" TEXT,
  ADD COLUMN "author" TEXT,
  ADD COLUMN "edition" TEXT,
  ADD COLUMN "courseCode" TEXT,
  ADD COLUMN "serviceDuration" INTEGER,
  ADD COLUMN "pricingUnit" TEXT,
  ADD COLUMN "availabilityNote" TEXT;

ALTER TABLE "Message"
  ADD COLUMN "attachmentUrl" TEXT,
  ADD COLUMN "offerAmount" DECIMAL(10,2);

ALTER TABLE "Transaction"
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "status" "TransactionStatus" NOT NULL DEFAULT 'RESERVED',
  ADD COLUMN "meetupPointId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "disputeReason" TEXT;

-- Existing transaction rows represented completed purchase history before lifecycle states existed.
UPDATE "Transaction" SET "status" = 'COMPLETED', "completedAt" = "createdAt";

CREATE TABLE "Review" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "revieweeId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "MeetupPoint" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "campusArea" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetupPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "imageUrl" TEXT,
  "location" TEXT,
  "eventDate" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" "AnnouncementStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Review_transactionId_key" ON "Review"("transactionId");
CREATE INDEX "Review_revieweeId_idx" ON "Review"("revieweeId");
CREATE UNIQUE INDEX "MeetupPoint_name_key" ON "MeetupPoint"("name");
CREATE INDEX "Announcement_status_eventDate_idx" ON "Announcement"("status", "eventDate");
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX "Transaction_buyerId_status_idx" ON "Transaction"("buyerId", "status");
CREATE INDEX "Transaction_sellerId_status_idx" ON "Transaction"("sellerId", "status");

ALTER TABLE "Listing" ADD CONSTRAINT "Listing_meetupPointId_fkey" FOREIGN KEY ("meetupPointId") REFERENCES "MeetupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_meetupPointId_fkey" FOREIGN KEY ("meetupPointId") REFERENCES "MeetupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
