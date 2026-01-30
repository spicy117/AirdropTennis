-- =============================================================================
-- Supabase Row Level Security (RLS) for academy multi-tenancy
-- Ensures users only see/modify data for their academy_id.
--
-- SAFE TO RUN when:
--   1. You have already run 001_academies_and_tenant_columns.sql.
--   2. For "everything is airdroptennis": run 001_bootstrap_airdroptennis.sql
--      so the academy exists and all rows (and profiles) have academy_id set.
--
-- This file only adds policies named "*_academy_*". It does NOT drop your
-- existing policies (e.g. "Admins can insert bookings for any user",
-- "Users can read their own booking requests"). Those stay; these add
-- academy scoping. Rows with academy_id IS NULL remain visible to everyone
-- until you backfill.
-- =============================================================================

-- Helper: get current user's academy_id from their profile (in public schema; auth schema is not writable from SQL Editor)
CREATE OR REPLACE FUNCTION public.user_academy_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT academy_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.user_academy_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_academy_id() TO service_role;

-- =============================================================================
-- academies: allow public read so app can resolve subdomain → academy_id
-- =============================================================================
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academies_public_select" ON academies;
CREATE POLICY "academies_public_select"
  ON academies FOR SELECT TO anon, authenticated
  USING (true);

-- =============================================================================
-- profiles: users see only profiles in their academy
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_academy_select" ON profiles;
CREATE POLICY "profiles_academy_select"
  ON profiles FOR SELECT TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "profiles_academy_insert" ON profiles;
CREATE POLICY "profiles_academy_insert"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "profiles_academy_update" ON profiles;
CREATE POLICY "profiles_academy_update"
  ON profiles FOR UPDATE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id())
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

-- =============================================================================
-- locations: scoped by academy_id
-- =============================================================================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locations_academy_select" ON locations;
CREATE POLICY "locations_academy_select"
  ON locations FOR SELECT TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "locations_academy_insert" ON locations;
CREATE POLICY "locations_academy_insert"
  ON locations FOR INSERT TO authenticated
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "locations_academy_update" ON locations;
CREATE POLICY "locations_academy_update"
  ON locations FOR UPDATE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id())
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "locations_academy_delete" ON locations;
CREATE POLICY "locations_academy_delete"
  ON locations FOR DELETE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

-- =============================================================================
-- bookings: scoped by academy_id
-- =============================================================================
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_academy_select" ON bookings;
CREATE POLICY "bookings_academy_select"
  ON bookings FOR SELECT TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "bookings_academy_insert" ON bookings;
CREATE POLICY "bookings_academy_insert"
  ON bookings FOR INSERT TO authenticated
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "bookings_academy_update" ON bookings;
CREATE POLICY "bookings_academy_update"
  ON bookings FOR UPDATE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id())
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "bookings_academy_delete" ON bookings;
CREATE POLICY "bookings_academy_delete"
  ON bookings FOR DELETE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

-- =============================================================================
-- availabilities: scoped by academy_id
-- =============================================================================
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availabilities_academy_select" ON availabilities;
CREATE POLICY "availabilities_academy_select"
  ON availabilities FOR SELECT TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "availabilities_academy_insert" ON availabilities;
CREATE POLICY "availabilities_academy_insert"
  ON availabilities FOR INSERT TO authenticated
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "availabilities_academy_update" ON availabilities;
CREATE POLICY "availabilities_academy_update"
  ON availabilities FOR UPDATE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id())
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "availabilities_academy_delete" ON availabilities;
CREATE POLICY "availabilities_academy_delete"
  ON availabilities FOR DELETE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

-- =============================================================================
-- booking_requests: scoped by academy_id
-- =============================================================================
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_requests_academy_select" ON booking_requests;
CREATE POLICY "booking_requests_academy_select"
  ON booking_requests FOR SELECT TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "booking_requests_academy_insert" ON booking_requests;
CREATE POLICY "booking_requests_academy_insert"
  ON booking_requests FOR INSERT TO authenticated
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "booking_requests_academy_update" ON booking_requests;
CREATE POLICY "booking_requests_academy_update"
  ON booking_requests FOR UPDATE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id())
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "booking_requests_academy_delete" ON booking_requests;
CREATE POLICY "booking_requests_academy_delete"
  ON booking_requests FOR DELETE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

-- =============================================================================
-- courts: scoped by academy_id
-- =============================================================================
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courts_academy_select" ON courts;
CREATE POLICY "courts_academy_select"
  ON courts FOR SELECT TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "courts_academy_insert" ON courts;
CREATE POLICY "courts_academy_insert"
  ON courts FOR INSERT TO authenticated
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "courts_academy_update" ON courts;
CREATE POLICY "courts_academy_update"
  ON courts FOR UPDATE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id())
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "courts_academy_delete" ON courts;
CREATE POLICY "courts_academy_delete"
  ON courts FOR DELETE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

-- =============================================================================
-- court_types: scoped by academy_id (if used per-tenant)
-- =============================================================================
ALTER TABLE court_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "court_types_academy_select" ON court_types;
CREATE POLICY "court_types_academy_select"
  ON court_types FOR SELECT TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "court_types_academy_insert" ON court_types;
CREATE POLICY "court_types_academy_insert"
  ON court_types FOR INSERT TO authenticated
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "court_types_academy_update" ON court_types;
CREATE POLICY "court_types_academy_update"
  ON court_types FOR UPDATE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id())
  WITH CHECK (academy_id IS NULL OR academy_id = public.user_academy_id());

DROP POLICY IF EXISTS "court_types_academy_delete" ON court_types;
CREATE POLICY "court_types_academy_delete"
  ON court_types FOR DELETE TO authenticated
  USING (academy_id IS NULL OR academy_id = public.user_academy_id());
