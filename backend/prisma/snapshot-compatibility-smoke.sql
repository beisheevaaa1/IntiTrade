BEGIN;

INSERT INTO "User" (id, email, name, "passwordHash", "updatedAt") VALUES
  ('11111111-1111-4111-8111-111111111111', 'snapshot-seller@test.invalid', 'Snapshot seller', 'test-only', now()),
  ('22222222-2222-4222-8222-222222222222', 'snapshot-buyer@test.invalid', 'Snapshot buyer', 'test-only', now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'snapshot-buyer-two@test.invalid', 'Snapshot buyer two', 'test-only', now());

INSERT INTO "Category" (id, name, slug) VALUES
  ('33333333-3333-4333-8333-333333333333', 'Snapshot test', 'snapshot-test');

INSERT INTO "Listing" (
  id, title, description, price, type, condition, status, location,
  quantity, "sellerId", "categoryId", "updatedAt"
) VALUES
  (
    '44444444-4444-4444-8444-444444444444', 'Approved one',
    'First approved snapshot test listing.', 10, 'PRODUCT', 'GOOD', 'ACTIVE', 'Campus', 3,
    '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now()
  ),
  (
    '55555555-5555-4555-8555-555555555555', 'Approved two',
    'Second approved snapshot test listing.', 20, 'PRODUCT', 'GOOD', 'ACTIVE', 'Campus', 1,
    '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now()
  ),
  (
    '99999999-9999-4999-8999-999999999999', 'Unreviewed draft',
    'This draft must never be captured by an old writer.', 30, 'PRODUCT', 'GOOD', 'PENDING', 'Campus', 1,
    '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now()
  );

INSERT INTO "ListingImage" (id, url, "listingId") VALUES
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '/uploads/snapshot-evidence.png',
    '44444444-4444-4444-8444-444444444444'
  );

-- These inserts deliberately omit listingSnapshot to emulate the application
-- version that can remain live briefly while the migration is applied.
INSERT INTO "Conversation" (id, "listingId", "buyerId", "sellerId", "updatedAt") VALUES
  (
    '66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', now()
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '99999999-9999-4999-8999-999999999999',
    '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', now()
  );

INSERT INTO "Report" (id, reason, "reporterId", "listingId", "updatedAt") VALUES
  (
    '77777777-7777-4777-8777-777777777777', 'Snapshot compatibility test',
    '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', now()
  );

INSERT INTO "Transaction" (id, "listingId", "buyerId", "sellerId", price, quantity) VALUES
  (
    '88888888-8888-4888-8888-888888888888', '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 10, 2
  );

DO $test$
BEGIN
  IF (SELECT "listingSnapshot"->>'title' FROM "Conversation" WHERE id = '66666666-6666-4666-8666-666666666666')
       IS DISTINCT FROM 'Approved one'
     OR (SELECT "listingSnapshot"->>'title' FROM "Report" WHERE id = '77777777-7777-4777-8777-777777777777')
       IS DISTINCT FROM 'Approved one'
     OR (SELECT "listingSnapshot"->>'title' FROM "Transaction" WHERE id = '88888888-8888-4888-8888-888888888888')
       IS DISTINCT FROM 'Approved one'
     OR (SELECT "listingSnapshot"->>'_snapshotProvenance' FROM "Transaction" WHERE id = '88888888-8888-4888-8888-888888888888')
       IS DISTINCT FROM 'captured'
     OR NOT EXISTS (
       SELECT 1
       FROM "Conversation" AS relationship
       CROSS JOIN LATERAL jsonb_array_elements(relationship."listingSnapshot"->'images') AS image(value)
       WHERE relationship.id = '66666666-6666-4666-8666-666666666666'
         AND image.value->>'url' = '/uploads/snapshot-evidence.png'
     ) THEN
    RAISE EXCEPTION 'old-writer inserts did not capture the approved listing';
  END IF;

  IF (SELECT "listingSnapshot" FROM "Conversation" WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
       IS NOT NULL THEN
    RAISE EXCEPTION 'an unapproved listing was captured by the compatibility trigger';
  END IF;
END;
$test$;

DO $test$
BEGIN
  -- A rollback writer may try the old in-place listing switch. It must fail
  -- without changing either the listing identity or the approved evidence.
  BEGIN
    UPDATE "Conversation"
    SET "listingId" = '55555555-5555-4555-8555-555555555555', "updatedAt" = now()
    WHERE id = '66666666-6666-4666-8666-666666666666';
    RAISE EXCEPTION 'legacy conversation relabelling was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Conversation listing identity is immutable; create another conversation' THEN
      RAISE;
    END IF;
  END;

  IF (SELECT "listingSnapshot"->>'title' FROM "Conversation" WHERE id = '66666666-6666-4666-8666-666666666666')
       IS DISTINCT FROM 'Approved one'
     OR (SELECT "listingId" FROM "Conversation" WHERE id = '66666666-6666-4666-8666-666666666666')
       IS DISTINCT FROM '44444444-4444-4444-8444-444444444444' THEN
    RAISE EXCEPTION 'rejected conversation relabelling changed historical evidence';
  END IF;

  BEGIN
    UPDATE "Conversation"
    SET "listingSnapshot" = jsonb_set("listingSnapshot", '{title}', '"tampered"')
    WHERE id = '66666666-6666-4666-8666-666666666666';
    RAISE EXCEPTION 'snapshot immutability trigger did not reject tampering';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Approved listing snapshots are immutable' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO "Transaction" (id, "listingId", "buyerId", "sellerId", price) VALUES
      (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444',
        '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 10
      );
    RAISE EXCEPTION 'duplicate active reservation was not rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END;
$test$;

DO $test$
BEGIN
  -- The database remains safe when a rolling old writer attempts to reserve an
  -- unapproved listing or overbook product stock.
  BEGIN
    INSERT INTO "Transaction" (id, "listingId", "buyerId", "sellerId", price) VALUES
      (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '99999999-9999-4999-8999-999999999999',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 30
      );
    RAISE EXCEPTION 'a pending listing received an active hold';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "Transaction" (id, "listingId", "buyerId", "sellerId", price, quantity) VALUES
      (
        'ffffffff-ffff-4fff-8fff-ffffffffffff', '44444444-4444-4444-8444-444444444444',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 10, 2
      );
    RAISE EXCEPTION 'product stock was overbooked';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "Transaction" (id, "listingId", "buyerId", "sellerId", price, quantity) VALUES
      (
        '13131313-1313-4313-8313-131313131313', '44444444-4444-4444-8444-444444444444',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 10, 0
      );
    RAISE EXCEPTION 'an active hold accepted a non-positive quantity';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "Listing" SET type = 'SERVICE'
    WHERE id = '44444444-4444-4444-8444-444444444444';
    RAISE EXCEPTION 'listing type changed underneath an active hold';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "Listing" SET quantity = 1
    WHERE id = '44444444-4444-4444-8444-444444444444';
    RAISE EXCEPTION 'listing quantity dropped below active holds';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "Listing" SET status = 'SOLD'
    WHERE id = '44444444-4444-4444-8444-444444444444';
    RAISE EXCEPTION 'listing closed while an active hold remained';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$test$;

-- A final-unit completion first releases its hold, then writes zero stock and
-- SOLD atomically. The database trigger must accept this legitimate sequence.
INSERT INTO "Transaction" (id, "listingId", "buyerId", "sellerId", price, quantity) VALUES
  (
    '12121212-1212-4212-8212-121212121212', '55555555-5555-4555-8555-555555555555',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 20, 1
  );

UPDATE "Transaction"
SET status = 'COMPLETED', "completedAt" = now()
WHERE id = '12121212-1212-4212-8212-121212121212';

UPDATE "Listing"
SET quantity = 0, status = 'SOLD'
WHERE id = '55555555-5555-4555-8555-555555555555'
  AND quantity = 1;

DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Listing"
    WHERE id = '55555555-5555-4555-8555-555555555555'
      AND quantity = 0
      AND status = 'SOLD'
  ) THEN
    RAISE EXCEPTION 'atomic final-unit completion did not settle inventory';
  END IF;
END;
$test$;

ROLLBACK;
