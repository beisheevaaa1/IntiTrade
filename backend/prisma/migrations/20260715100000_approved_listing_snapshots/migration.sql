-- Keep relationship history tied to the last representation that was actually
-- approved for the marketplace. Current PENDING/REJECTED edits must never leak
-- through conversations, transactions, reports, or other relationship routes.
BEGIN;

ALTER TABLE "Conversation" ADD COLUMN "listingSnapshot" JSONB;
ALTER TABLE "Transaction" ADD COLUMN "listingSnapshot" JSONB;
ALTER TABLE "Report" ADD COLUMN "listingSnapshot" JSONB;

-- During a rolling deploy (and after a rollback), the preceding application
-- version still writes relationship rows without the new snapshot column. Keep
-- those writes safe by letting PostgreSQL capture the currently ACTIVE revision.
CREATE FUNCTION "approvedListingSnapshotFor"("targetListingId" TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    '_snapshotVersion', 1,
    '_snapshotProvenance', 'captured',
    'id', listing.id,
    'title', listing.title,
    'description', listing.description,
    'price', listing.price::text,
    'type', listing.type,
    'condition', listing.condition,
    'status', 'ACTIVE',
    'location', listing.location,
    'rejectionReason', NULL,
    'viewsCount', listing."viewsCount",
    'interestCount', listing."interestCount",
    'isNegotiable', listing."isNegotiable",
    'showPhone', listing."showPhone",
    'meetupPreference', listing."meetupPreference",
    'meetupPointId', listing."meetupPointId",
    'quantity', listing.quantity,
    'isRecurring', listing."isRecurring",
    'isbn', listing.isbn,
    'author', listing.author,
    'edition', listing.edition,
    'courseCode', listing."courseCode",
    'serviceDuration', listing."serviceDuration",
    'pricingUnit', listing."pricingUnit",
    'availabilityNote', listing."availabilityNote",
    'sellerId', listing."sellerId",
    'categoryId', listing."categoryId",
    'createdAt', listing."createdAt",
    'updatedAt', listing."updatedAt",
    'images', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', image.id,
        'url', image.url,
        'listingId', image."listingId",
        'createdAt', image."createdAt"
      ) ORDER BY image."createdAt", image.id)
      FROM "ListingImage" AS image
      WHERE image."listingId" = listing.id
    ), '[]'::jsonb),
    'category', jsonb_build_object(
      'id', category.id,
      'name', category.name,
      'slug', category.slug,
      'createdAt', category."createdAt"
    ),
    'meetupPoint', CASE WHEN meetup.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', meetup.id,
      'name', meetup.name,
      'description', meetup.description,
      'campusArea', meetup."campusArea",
      'isActive', meetup."isActive",
      'createdAt', meetup."createdAt"
    ) END
  )
  FROM "Listing" AS listing
  JOIN "Category" AS category ON category.id = listing."categoryId"
  LEFT JOIN "MeetupPoint" AS meetup ON meetup.id = listing."meetupPointId"
  WHERE listing.id = "targetListingId"
    AND listing.status = 'ACTIVE';
$$;

CREATE FUNCTION "populateApprovedListingSnapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."listingSnapshot" IS NULL THEN
    NEW."listingSnapshot" := "approvedListingSnapshotFor"(NEW."listingId");
  END IF;
  RETURN NEW;
END;
$$;

-- Only ACTIVE rows are safe to backfill. A non-active legacy row may already
-- contain never-approved edits, so those relationships intentionally remain
-- NULL and are rendered as redacted placeholders by the API.
CREATE TEMPORARY TABLE "_ApprovedListingSnapshotBackfill" AS
SELECT
  listing.id AS "listingId",
  jsonb_build_object(
    '_snapshotVersion', 1,
    '_snapshotProvenance', 'reconstructed',
    'id', listing.id,
    'title', listing.title,
    'description', listing.description,
    'price', listing.price::text,
    'type', listing.type,
    'condition', listing.condition,
    'status', 'ACTIVE',
    'location', listing.location,
    'rejectionReason', NULL,
    'viewsCount', listing."viewsCount",
    'interestCount', listing."interestCount",
    'isNegotiable', listing."isNegotiable",
    'showPhone', listing."showPhone",
    'meetupPreference', listing."meetupPreference",
    'meetupPointId', listing."meetupPointId",
    'quantity', listing.quantity,
    'isRecurring', listing."isRecurring",
    'isbn', listing.isbn,
    'author', listing.author,
    'edition', listing.edition,
    'courseCode', listing."courseCode",
    'serviceDuration', listing."serviceDuration",
    'pricingUnit', listing."pricingUnit",
    'availabilityNote', listing."availabilityNote",
    'sellerId', listing."sellerId",
    'categoryId', listing."categoryId",
    'createdAt', listing."createdAt",
    'updatedAt', listing."updatedAt",
    'images', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', image.id,
        'url', image.url,
        'listingId', image."listingId",
        'createdAt', image."createdAt"
      ) ORDER BY image."createdAt", image.id)
      FROM "ListingImage" AS image
      WHERE image."listingId" = listing.id
    ), '[]'::jsonb),
    'category', jsonb_build_object(
      'id', category.id,
      'name', category.name,
      'slug', category.slug,
      'createdAt', category."createdAt"
    ),
    'meetupPoint', CASE WHEN meetup.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', meetup.id,
      'name', meetup.name,
      'description', meetup.description,
      'campusArea', meetup."campusArea",
      'isActive', meetup."isActive",
      'createdAt', meetup."createdAt"
    ) END
  ) AS snapshot
FROM "Listing" AS listing
JOIN "Category" AS category ON category.id = listing."categoryId"
LEFT JOIN "MeetupPoint" AS meetup ON meetup.id = listing."meetupPointId"
WHERE listing.status = 'ACTIVE';

UPDATE "Conversation" AS relationship
SET "listingSnapshot" = backfill.snapshot
FROM "_ApprovedListingSnapshotBackfill" AS backfill
WHERE relationship."listingId" = backfill."listingId";

UPDATE "Transaction" AS relationship
SET "listingSnapshot" = backfill.snapshot
FROM "_ApprovedListingSnapshotBackfill" AS backfill
WHERE relationship."listingId" = backfill."listingId";

UPDATE "Report" AS relationship
SET "listingSnapshot" = backfill.snapshot
FROM "_ApprovedListingSnapshotBackfill" AS backfill
WHERE relationship."listingId" = backfill."listingId";

DROP TABLE "_ApprovedListingSnapshotBackfill";

-- Backfill can reconstruct what is visible at cutover, but cannot prove the
-- historical revision. The UI redacts those reconstructed relationship views.
-- Existing open reservations retain the legacy application's live-inventory
-- behaviour, but only after stock/type/identity checks below prove that the
-- current active listing can still honour the hold.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Transaction"
    WHERE status IN ('RESERVED', 'DISPUTED')
      AND quantity < 1
  ) THEN
    RAISE EXCEPTION 'Resolve active reservations with invalid quantities before migrating';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Transaction" AS relationship
    JOIN "Listing" AS listing ON listing.id = relationship."listingId"
    WHERE relationship.status IN ('RESERVED', 'DISPUTED')
      AND listing.type = 'PRODUCT'
    GROUP BY relationship."listingId", listing.quantity
    HAVING sum(relationship.quantity) > listing.quantity
  ) THEN
    RAISE EXCEPTION 'Resolve product reservations that exceed current listing stock before migrating';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Transaction"
    WHERE status IN ('RESERVED', 'DISPUTED')
      AND (
        "listingSnapshot" IS NULL
        OR "listingSnapshot"->>'_snapshotVersion' IS DISTINCT FROM '1'
        OR "listingSnapshot"->>'_snapshotProvenance' NOT IN ('captured', 'reconstructed')
        OR "listingSnapshot"->>'status' IS DISTINCT FROM 'ACTIVE'
        OR "listingSnapshot"->>'id' IS DISTINCT FROM "listingId"
        OR "listingSnapshot"->>'type' NOT IN ('PRODUCT', 'COURSE', 'SERVICE')
      )
  ) THEN
    RAISE EXCEPTION 'Resolve active reservations that do not have a valid current approved listing';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Transaction" AS relationship
    JOIN "Listing" AS listing ON listing.id = relationship."listingId"
    WHERE relationship.status IN ('RESERVED', 'DISPUTED')
      AND relationship."listingSnapshot"->>'type' IS DISTINCT FROM listing.type::text
  ) THEN
    RAISE EXCEPTION 'Resolve active reservations whose approved type differs from the current listing type';
  END IF;

END;
$$;

-- Application locks make reservations deterministic, while this partial index
-- also protects rolling-deploy/rollback writers that predate those locks.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Transaction"
    WHERE status IN ('RESERVED', 'DISPUTED')
    GROUP BY "listingId", "buyerId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate active reservations before applying approved listing snapshots';
  END IF;
END;
$$;

CREATE UNIQUE INDEX "Transaction_one_active_reservation_per_buyer_listing"
ON "Transaction" ("listingId", "buyerId")
WHERE status IN ('RESERVED', 'DISPUTED');

-- Snapshot media lookups use JSON containment. These indexes avoid scanning
-- every historical relationship whenever a seller deletes media or the orphan
-- cleanup processes a batch.
CREATE INDEX "Conversation_listingSnapshot_idx"
ON "Conversation" USING GIN ("listingSnapshot" jsonb_path_ops);

CREATE INDEX "Transaction_listingSnapshot_idx"
ON "Transaction" USING GIN ("listingSnapshot" jsonb_path_ops);

CREATE INDEX "Report_listingSnapshot_idx"
ON "Report" USING GIN ("listingSnapshot" jsonb_path_ops);

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingSnapshot_approved_check"
CHECK (
  "listingSnapshot" IS NULL OR (
    "listingSnapshot"->>'_snapshotVersion' = '1'
    AND "listingSnapshot"->>'_snapshotProvenance' IN ('captured', 'reconstructed')
    AND "listingSnapshot"->>'status' = 'ACTIVE'
    AND "listingSnapshot"->>'id' = "listingId"
  )
);

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_listingSnapshot_approved_check"
CHECK (
  "listingSnapshot" IS NULL OR (
    "listingSnapshot"->>'_snapshotVersion' = '1'
    AND "listingSnapshot"->>'_snapshotProvenance' IN ('captured', 'reconstructed')
    AND "listingSnapshot"->>'status' = 'ACTIVE'
    AND "listingSnapshot"->>'id' = "listingId"
    AND "listingSnapshot"->>'type' IN ('PRODUCT', 'COURSE', 'SERVICE')
  )
);

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_active_hold_snapshot_check"
CHECK (
  status NOT IN ('RESERVED', 'DISPUTED')
  OR COALESCE("listingSnapshot"->>'_snapshotProvenance' IN ('captured', 'reconstructed'), false)
);

ALTER TABLE "Report" ADD CONSTRAINT "Report_listingSnapshot_approved_check"
CHECK (
  "listingSnapshot" IS NULL OR (
    "listingSnapshot"->>'_snapshotVersion' = '1'
    AND "listingSnapshot"->>'_snapshotProvenance' IN ('captured', 'reconstructed')
    AND "listingSnapshot"->>'status' = 'ACTIVE'
    AND "listingSnapshot"->>'id' = "listingId"
  )
);

CREATE FUNCTION "protectApprovedListingSnapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- The release immediately preceding snapshots changed Conversation.listingId
  -- in place. Reject that legacy mutation after migration: accepting it would
  -- relabel existing messages as evidence for a different marketplace item.
  IF TG_TABLE_NAME = 'Conversation'
     AND NEW."listingId" IS DISTINCT FROM OLD."listingId"
     AND NEW."listingSnapshot" IS NOT DISTINCT FROM OLD."listingSnapshot" THEN
    RAISE EXCEPTION 'Conversation listing identity is immutable; create another conversation';
  END IF;

  IF NEW."listingId" IS DISTINCT FROM OLD."listingId"
     OR NEW."listingSnapshot" IS DISTINCT FROM OLD."listingSnapshot" THEN
    RAISE EXCEPTION 'Approved listing snapshots are immutable';
  END IF;

  RETURN NEW;
END;
$$;

-- Database-level inventory rules remain effective if an automatic deploy
-- rollback temporarily runs the snapshot-unaware application release.
CREATE FUNCTION "protectHeldListingInventory"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  held_quantity INTEGER;
  incompatible_type BOOLEAN;
BEGIN
  IF NEW.type = 'PRODUCT'
     AND NEW.quantity < 1
     AND NEW.status NOT IN ('SOLD', 'ARCHIVED') THEN
    RAISE EXCEPTION 'A product listing needs positive stock before submission or activation'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(sum(relationship.quantity), 0)::INTEGER,
    COALESCE(bool_or(relationship."listingSnapshot"->>'type' <> NEW.type::text), false)
  INTO held_quantity, incompatible_type
  FROM "Transaction" AS relationship
  WHERE relationship."listingId" = NEW.id
    AND relationship.status IN ('RESERVED', 'DISPUTED');

  IF incompatible_type THEN
    RAISE EXCEPTION 'Active reservations prevent changing the listing type'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status IN ('SOLD', 'ARCHIVED') AND held_quantity > 0 THEN
    RAISE EXCEPTION 'Active reservations prevent closing the listing'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.type = 'PRODUCT' AND NEW.quantity < held_quantity THEN
    RAISE EXCEPTION 'Listing quantity is lower than active reservations'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION "validateTransactionInventoryHold"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  listing_type "ListingType";
  listing_status "ListingStatus";
  listing_quantity INTEGER;
  held_quantity INTEGER;
  approved_type TEXT;
BEGIN
  IF NEW.status NOT IN ('RESERVED', 'DISPUTED') THEN
    RETURN NEW;
  END IF;

  IF NEW.quantity < 1 THEN
    RAISE EXCEPTION 'Reservation quantity must be positive'
      USING ERRCODE = '23514';
  END IF;

  SELECT type, status, quantity
  INTO listing_type, listing_status, listing_quantity
  FROM "Listing"
  WHERE id = NEW."listingId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND listing_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Only an active listing can receive a reservation'
      USING ERRCODE = '23514';
  END IF;

  approved_type := NEW."listingSnapshot"->>'type';
  IF approved_type IS NULL OR approved_type <> listing_type::text THEN
    RAISE EXCEPTION 'Reservation inventory type does not match the approved listing'
      USING ERRCODE = '23514';
  END IF;

  IF approved_type = 'PRODUCT' THEN
    SELECT COALESCE(sum(relationship.quantity), 0)::INTEGER
    INTO held_quantity
    FROM "Transaction" AS relationship
    WHERE relationship."listingId" = NEW."listingId"
      AND relationship.status IN ('RESERVED', 'DISPUTED')
      AND relationship.id <> NEW.id;

    IF held_quantity + NEW.quantity > listing_quantity THEN
      RAISE EXCEPTION 'Reservation quantity exceeds available listing stock'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Conversation_populate_listing_snapshot"
BEFORE INSERT ON "Conversation"
FOR EACH ROW EXECUTE FUNCTION "populateApprovedListingSnapshot"();

CREATE TRIGGER "Transaction_populate_listing_snapshot"
BEFORE INSERT ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION "populateApprovedListingSnapshot"();

CREATE TRIGGER "Report_populate_listing_snapshot"
BEFORE INSERT ON "Report"
FOR EACH ROW EXECUTE FUNCTION "populateApprovedListingSnapshot"();

CREATE TRIGGER "Listing_protect_held_inventory"
BEFORE UPDATE OF type, quantity, status ON "Listing"
FOR EACH ROW EXECUTE FUNCTION "protectHeldListingInventory"();

CREATE TRIGGER "Transaction_validate_inventory_hold"
BEFORE INSERT OR UPDATE OF status, quantity, "listingId", "listingSnapshot" ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION "validateTransactionInventoryHold"();

CREATE TRIGGER "Conversation_protect_listing_snapshot"
BEFORE UPDATE ON "Conversation"
FOR EACH ROW EXECUTE FUNCTION "protectApprovedListingSnapshot"();

CREATE TRIGGER "Transaction_protect_listing_snapshot"
BEFORE UPDATE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION "protectApprovedListingSnapshot"();

CREATE TRIGGER "Report_protect_listing_snapshot"
BEFORE UPDATE ON "Report"
FOR EACH ROW EXECUTE FUNCTION "protectApprovedListingSnapshot"();

COMMIT;
