INSERT INTO "Category" ("id", "name", "slug", "createdAt")
VALUES
  ('5f6f29be-5206-4e03-bf7b-0d97f9a5e101', 'For free', 'for-free', now()),
  ('1a9f3f35-93d9-4d83-9d5c-3d61f58f0a22', 'Home Decor', 'home-decor', now())
ON CONFLICT ("slug") DO NOTHING;

DROP INDEX IF EXISTS "Review_transactionId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Review_transactionId_reviewerId_key"
ON "Review"("transactionId", "reviewerId");
