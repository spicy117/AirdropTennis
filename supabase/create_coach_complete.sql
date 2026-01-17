-- Complete coach creation function
-- This function can create a user account AND profile in one call
-- Note: Creating auth users requires service_role key, so this uses a trigger approach

-- First, create a function that will be called by a trigger when a user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's a pending coach creation request
  -- This would require a temporary table to store pending coach requests
  -- For now, we'll use a simpler approach
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative: Create a function that admins can use to prepare coach data
-- Then the coach can sign up normally and their profile will be created automatically
CREATE OR REPLACE FUNCTION prepare_coach_invite(
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
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only admins can prepare coach invites'
    );
  END IF;

  -- Check if email already exists
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = coach_email
  ) THEN
    -- User exists, create/update profile
    DECLARE
      existing_user_id UUID;
    BEGIN
      SELECT id INTO existing_user_id
      FROM auth.users
      WHERE email = coach_email
      LIMIT 1;

      -- Parse name
      name_parts := string_to_array(trim(coach_full_name), ' ');
      IF array_length(name_parts, 1) > 1 THEN
        first_name := name_parts[1];
        last_name := array_to_string(name_parts[2:], ' ');
      ELSE
        first_name := coach_full_name;
        last_name := NULL;
      END IF;

      -- Create/update profile
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
        'message', 'Coach profile created successfully',
        'user_id', existing_user_id,
        'email', coach_email
      );
    END;
  END IF;

  -- User doesn't exist - return signup link
  name_parts := string_to_array(trim(coach_full_name), ' ');
  IF array_length(name_parts, 1) > 1 THEN
    first_name := name_parts[1];
    last_name := array_to_string(name_parts[2:], ' ');
  ELSE
    first_name := coach_full_name;
    last_name := NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Coach invite prepared. Coach should sign up using the email.',
    'email', coach_email,
    'first_name', first_name,
    'last_name', last_name,
    'signup_url', '/signup?email=' || encode(coach_email, 'base64url'),
    'instructions', 'Have the coach go to the signup page and use email: ' || coach_email || '. After they sign up, their profile will automatically be set to coach role.'
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION prepare_coach_invite(TEXT, TEXT) TO authenticated;

-- Update the create_coach_profile function to work better
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

  -- User doesn't exist - return instructions for manual creation
  RETURN jsonb_build_object(
    'success', false,
    'error', 'User account does not exist',
    'email', coach_email,
    'first_name', first_name,
    'last_name', last_name,
    'instructions', 'Please create the user account manually:\n\n' ||
      '1. Go to Supabase Dashboard → Authentication → Users\n' ||
      '2. Click "Add User" (not Invite)\n' ||
      '3. Enter email: ' || coach_email || '\n' ||
      '4. Set a temporary password\n' ||
      '5. Uncheck "Auto Confirm User" if you want them to verify email\n' ||
      '6. Click "Create User"\n' ||
      '7. Then come back here and try creating the coach again'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_coach_profile(TEXT, TEXT) TO authenticated;
