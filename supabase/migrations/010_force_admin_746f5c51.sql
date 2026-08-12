-- Force this user to admin in BOTH profiles and auth metadata.
-- Run in Supabase SQL Editor (project: rozxeqqwxpnfqbyvtvch).

-- 1) Role lookup RPC (app needs this)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 2) Promote this exact user
UPDATE public.profiles
SET role = 'admin'
WHERE id = '746f5c51-f9d2-4dc0-9792-071aefe36f22';

UPDATE auth.users
SET raw_user_meta_data =
  COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE id = '746f5c51-f9d2-4dc0-9792-071aefe36f22';

-- 3) Verify (must show admin / admin)
SELECT
  p.id,
  p.email,
  p.role AS profile_role,
  u.raw_user_meta_data->>'role' AS auth_meta_role
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.id = '746f5c51-f9d2-4dc0-9792-071aefe36f22';
