-- =============================================================================
-- Academy multi-tenant schema
-- Run in Supabase SQL Editor (or via Supabase CLI).
-- =============================================================================

-- 1. Create academies table
CREATE TABLE IF NOT EXISTS academies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain_prefix text NOT NULL UNIQUE,
  stripe_connect_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academies_subdomain_prefix ON academies (subdomain_prefix);

COMMENT ON TABLE academies IS 'Tenant table: one row per academy (subdomain)';
COMMENT ON COLUMN academies.subdomain_prefix IS 'Subdomain without dot, e.g. airdroptennis for airdroptennis.servestream.com';

-- 2. Add academy_id to tenant-scoped tables
--    (lessons → bookings, coaches/students → profiles, locations; plus related tables)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

-- Related tables that belong to an academy
ALTER TABLE availabilities
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

ALTER TABLE courts
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

ALTER TABLE court_types
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

-- Indexes for common filters
CREATE INDEX IF NOT EXISTS idx_profiles_academy_id ON profiles (academy_id);
CREATE INDEX IF NOT EXISTS idx_locations_academy_id ON locations (academy_id);
CREATE INDEX IF NOT EXISTS idx_bookings_academy_id ON bookings (academy_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_academy_id ON availabilities (academy_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_academy_id ON booking_requests (academy_id);
CREATE INDEX IF NOT EXISTS idx_courts_academy_id ON courts (academy_id);
CREATE INDEX IF NOT EXISTS idx_court_types_academy_id ON court_types (academy_id);

-- Optional: backfill a default academy for existing rows (run after inserting one academy)
-- INSERT INTO academies (name, subdomain_prefix) VALUES ('Default Academy', 'www') ON CONFLICT (subdomain_prefix) DO NOTHING;
-- UPDATE profiles   SET academy_id = (SELECT id FROM academies WHERE subdomain_prefix = 'www') WHERE academy_id IS NULL;
-- UPDATE locations  SET academy_id = (SELECT id FROM academies WHERE subdomain_prefix = 'www') WHERE academy_id IS NULL;
-- UPDATE bookings   SET academy_id = (SELECT id FROM academies WHERE subdomain_prefix = 'www') WHERE academy_id IS NULL;
-- (repeat for availabilities, booking_requests, courts, court_types)
