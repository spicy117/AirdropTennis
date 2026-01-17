-- Create a function to create a new coach account
-- This function checks if the requester is an admin, creates a user account, and creates a profile

CREATE OR REPLACE FUNCTION create_coach(
  coach_email TEXT,
  coach_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  name_parts TEXT[];
  first_name TEXT;
  last_name TEXT;
  temp_password TEXT;
  result JSONB;
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

  -- Check if email already exists
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = coach_email
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email already exists'
    );
  END IF;

  -- Parse full name into first and last name
  name_parts := string_to_array(trim(coach_full_name), ' ');
  IF array_length(name_parts, 1) > 1 THEN
    first_name := name_parts[1];
    last_name := array_to_string(name_parts[2:], ' ');
  ELSE
    first_name := coach_full_name;
    last_name := NULL;
  END IF;

  -- Generate a temporary password (random string)
  temp_password := encode(gen_random_bytes(16), 'base64');

  -- Create user in auth.users using Supabase Auth Admin API
  -- Note: This requires using the Supabase Admin API from the client
  -- For now, we'll return the temp password and let the client create the user
  -- The actual user creation should be done via Supabase Admin API or Edge Function
  
  -- Return success with instructions
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Coach creation initiated. Use Supabase Admin API to create the user account.',
    'temp_password', temp_password,
    'first_name', first_name,
    'last_name', last_name,
    'email', coach_email
  );
END;
$$;

-- Create a function that can be called after user is created to set up the profile
CREATE OR REPLACE FUNCTION setup_coach_profile(
  user_id UUID,
  coach_first_name TEXT,
  coach_last_name TEXT,
  coach_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only admins can set up coach profiles'
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User does not exist'
    );
  END IF;

  -- Insert or update profile with coach role
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (user_id, coach_email, coach_first_name, coach_last_name, 'coach')
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = 'coach',
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Coach profile created successfully'
  );
END;
$$;

-- Grant execute permissions to authenticated users (RLS will check admin role)
GRANT EXECUTE ON FUNCTION create_coach(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION setup_coach_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
