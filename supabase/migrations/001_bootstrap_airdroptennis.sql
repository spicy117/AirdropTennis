-- =============================================================================
-- Single-tenant bootstrap: everything is "airdroptennis"
-- Run this AFTER 001_academies_and_tenant_columns.sql.
-- Run 002_academy_rls.sql after this (or before; policies allow academy_id NULL).
-- =============================================================================

-- 1. Create the airdroptennis academy (idempotent)
INSERT INTO academies (name, subdomain_prefix)
VALUES ('Airdrop Tennis', 'airdroptennis')
ON CONFLICT (subdomain_prefix) DO NOTHING;

-- 2. Backfill academy_id for all existing rows
DO $$
DECLARE
  aid uuid;
BEGIN
  SELECT id INTO aid FROM academies WHERE subdomain_prefix = 'airdroptennis' LIMIT 1;
  IF aid IS NOT NULL THEN
    UPDATE profiles        SET academy_id = aid WHERE academy_id IS NULL;
    UPDATE locations       SET academy_id = aid WHERE academy_id IS NULL;
    UPDATE bookings        SET academy_id = aid WHERE academy_id IS NULL;
    UPDATE availabilities  SET academy_id = aid WHERE academy_id IS NULL;
    UPDATE booking_requests SET academy_id = aid WHERE academy_id IS NULL;
    UPDATE courts          SET academy_id = aid WHERE academy_id IS NULL;
    UPDATE court_types     SET academy_id = aid WHERE academy_id IS NULL;
  END IF;
END $$;
