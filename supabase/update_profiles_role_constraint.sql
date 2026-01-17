-- Update profiles table to ensure role field supports 'student', 'coach', and 'admin'
-- This migration ensures the role field has a proper CHECK constraint

-- First, drop any existing role constraint if it exists
DO $$ 
BEGIN
    -- Try to drop existing constraint if it exists
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint might not exist or have a different name, continue
        NULL;
END $$;

-- Add or update the role column with CHECK constraint
-- If the column doesn't exist, create it; if it exists, ensure it has the constraint
DO $$
BEGIN
    -- Check if role column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        -- Add role column if it doesn't exist
        ALTER TABLE profiles ADD COLUMN role TEXT;
    END IF;
END $$;

-- Add CHECK constraint to ensure role is one of the allowed values
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('student', 'coach', 'admin'));

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
