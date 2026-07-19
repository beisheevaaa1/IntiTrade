DO $$
DECLARE
  old_meetup_point_id TEXT;
  new_meetup_point_id TEXT;
BEGIN
  SELECT "id" INTO old_meetup_point_id
  FROM "MeetupPoint"
  WHERE "name" = 'Student Centre Help Desk';

  IF old_meetup_point_id IS NOT NULL THEN
    SELECT "id" INTO new_meetup_point_id
    FROM "MeetupPoint"
    WHERE "name" = 'Student Centre Entrance';

    IF new_meetup_point_id IS NULL THEN
      UPDATE "MeetupPoint"
      SET
        "name" = 'Student Centre Entrance',
        "description" = 'Busy public lobby near the entrance'
      WHERE "id" = old_meetup_point_id;
    ELSE
      UPDATE "Listing"
      SET "meetupPointId" = new_meetup_point_id
      WHERE "meetupPointId" = old_meetup_point_id;

      UPDATE "Transaction"
      SET "meetupPointId" = new_meetup_point_id
      WHERE "meetupPointId" = old_meetup_point_id;

      DELETE FROM "MeetupPoint"
      WHERE "id" = old_meetup_point_id;
    END IF;
  END IF;
END $$;

UPDATE "Listing"
SET "meetupPreference" = CASE "meetupPreference"
  WHEN 'Student Center' THEN 'Student Centre'
  WHEN 'Dormitory Block A' THEN 'Hostel Block A'
  WHEN 'Dormitory Block B' THEN 'Hostel Block E'
  ELSE "meetupPreference"
END
WHERE "meetupPreference" IN (
  'Student Center',
  'Dormitory Block A',
  'Dormitory Block B'
);
