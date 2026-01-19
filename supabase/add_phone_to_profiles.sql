-- Add phone field to profiles table
-- This stores mobile phone numbers for students (required field during signup)
-- 
-- IMPORTANT: Only run this once to add the column.
-- The phone number will be saved via the app after user creation.

-- Add phone column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;
