-- Read-only production data prerequisites. The deploy runner executes this
-- before entering maintenance or recording that a schema mutation started.
-- A failure therefore leaves the currently active API and database untouched.
DO $$
DECLARE
  invalid_holds INTEGER;
  oversold_products INTEGER;
  duplicate_holds INTEGER;
  invalid_quantities INTEGER;
  snapshot_column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Transaction'
      AND column_name = 'listingSnapshot'
  ) INTO snapshot_column_exists;

  IF snapshot_column_exists THEN
    EXECUTE $query$
      SELECT count(*)
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
    $query$ INTO invalid_holds;
  ELSE
    -- Before the snapshot migration, legacy reservations have no immutable
    -- evidence column. They are preserved with a `reconstructed` cutover
    -- snapshot; later checks still reject invalid stock or duplicate holds.
    invalid_holds := 0;
  END IF;

  IF invalid_holds > 0 THEN
    RAISE EXCEPTION
      'Pre-deploy check failed: % active reservation(s) have an invalid inventory snapshot',
      invalid_holds;
  END IF;

  SELECT count(*)
  INTO invalid_quantities
  FROM "Transaction"
  WHERE status IN ('RESERVED', 'DISPUTED')
    AND quantity < 1;

  IF invalid_quantities > 0 THEN
    RAISE EXCEPTION
      'Pre-deploy check failed: % active reservation(s) have an invalid quantity',
      invalid_quantities;
  END IF;

  SELECT count(*)
  INTO duplicate_holds
  FROM (
    SELECT "listingId", "buyerId"
    FROM "Transaction"
    WHERE status IN ('RESERVED', 'DISPUTED')
    GROUP BY "listingId", "buyerId"
    HAVING count(*) > 1
  ) AS duplicates;

  IF duplicate_holds > 0 THEN
    RAISE EXCEPTION
      'Pre-deploy check failed: % listing/buyer pair(s) have duplicate active reservations',
      duplicate_holds;
  END IF;

  SELECT count(*)
  INTO oversold_products
  FROM (
    SELECT relationship."listingId"
    FROM "Transaction" AS relationship
    JOIN "Listing" AS listing ON listing.id = relationship."listingId"
    WHERE relationship.status IN ('RESERVED', 'DISPUTED')
      AND listing.type = 'PRODUCT'
    GROUP BY relationship."listingId", listing.quantity
    HAVING sum(relationship.quantity) > listing.quantity
  ) AS conflicts;

  IF oversold_products > 0 THEN
    RAISE EXCEPTION
      'Pre-deploy check failed: % product listing(s) have reservations above available stock',
      oversold_products;
  END IF;
END;
$$;
