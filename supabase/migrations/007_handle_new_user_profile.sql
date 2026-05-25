-- Auto-create a profiles row when a new auth user signs up.
-- Required for signup/login: the app reads role and data from public.profiles.
-- Run this in Supabase SQL Editor on your project if signup does not create profiles.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_academy_id uuid;
  v_full_name text;
BEGIN
  SELECT id INTO default_academy_id
  FROM public.academies
  WHERE subdomain_prefix = 'airdroptennis'
  LIMIT 1;

  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(concat(
      coalesce(NEW.raw_user_meta_data->>'first_name', ''),
      ' ',
      coalesce(NEW.raw_user_meta_data->>'last_name', '')
    )), ''),
    NEW.email
  );

  -- Public signup via auth.users: always student (admins set coach/admin via dashboard after)
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    full_name,
    phone,
    role,
    academy_id
  ) VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    v_full_name,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'student',
    default_academy_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    role = COALESCE(public.profiles.role, 'student'),
    academy_id = COALESCE(public.profiles.academy_id, EXCLUDED.academy_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Allow authenticated users to create their own profile if the trigger did not run
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- One-time backfill: auth users who signed up before this trigger existed
INSERT INTO public.profiles (id, email, first_name, last_name, full_name, role, academy_id)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name',
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(concat(
      coalesce(u.raw_user_meta_data->>'first_name', ''),
      ' ',
      coalesce(u.raw_user_meta_data->>'last_name', '')
    )), ''),
    u.email
  ),
  'student',
  (SELECT id FROM public.academies WHERE subdomain_prefix = 'airdroptennis' LIMIT 1)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
