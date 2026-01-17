-- Simplified coach creation function that works without Edge Functions
-- This function validates the request and prepares coach data
-- User creation must be done via Supabase Dashboard or invite system

CREATE OR REPLACE FUNCTION create_coach_profile(
  coach_email TEXT,
  coach_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  name_parts TEXT[];
  first_name TEXT;
  last_name TEXT;
  existing_user_id UUID;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only admins can create coaches'
    );
  END IF;

  -- Check if email already exists in auth.users
  SELECT id INTO existing_user_id
  FROM auth.users
  WHERE email = coach_email
  LIMIT 1;

  -- Parse full name into first and last name
  name_parts := string_to_array(trim(coach_full_name), ' ');
  IF array_length(name_parts, 1) > 1 THEN
    first_name := name_parts[1];
    last_name := array_to_string(name_parts[2:], ' ');
  ELSE
    first_name := coach_full_name;
    last_name := NULL;
  END IF;

  -- If user already exists, just update/create their profile
  IF existing_user_id IS NOT NULL THEN
    -- Insert or update profile with coach role
    INSERT INTO profiles (id, email, first_name, last_name, role)
    VALUES (existing_user_id, coach_email, first_name, last_name, 'coach')
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      role = 'coach',
      updated_at = NOW();

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Coach profile created/updated successfully',
      'user_id', existing_user_id,
      'email', coach_email,
      'note', 'User account already existed. Profile has been updated to coach role.'
    );
  END IF;

  -- User doesn't exist - return instructions
  RETURN jsonb_build_object(
    'success', false,
    'error', 'User account does not exist',
    'instructions', 'Please create the user account first via Supabase Dashboard (Authentication → Users → Add User) or use the invite system, then try again.',
    'email', coach_email,
    'first_name', first_name,
    'last_name', last_name
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_coach_profile(TEXT, TEXT) TO authenticated;
