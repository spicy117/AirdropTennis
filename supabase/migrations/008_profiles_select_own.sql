-- Users must always read their own profile (role, academy_id) for login routing.
-- Without this, profiles_academy_select can block the row and the app falls back to stale user_metadata (e.g. coach).

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
