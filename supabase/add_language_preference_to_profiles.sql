-- Add language_preference field to profiles table
-- This allows users to store their preferred language (English or Mandarin Simplified)

-- Add language_preference column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';

-- Drop existing constraint if it exists, then add the CHECK constraint
DO $$ 
BEGIN
    -- Try to drop existing constraint if it exists
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_language_preference_check;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint might not exist, continue
        NULL;
END $$;

-- Add CHECK constraint to ensure language_preference is either 'en' or 'zh-CN'
ALTER TABLE profiles 
ADD CONSTRAINT profiles_language_preference_check 
CHECK (language_preference IN ('en', 'zh-CN'));

-- Create index for faster queries on language_preference
CREATE INDEX IF NOT EXISTS idx_profiles_language_preference ON profiles(language_preference);

-- Add a comment documenting the field
COMMENT ON COLUMN profiles.language_preference IS 'User preferred language: ''en'' for English, ''zh-CN'' for Mandarin (Simplified). Defaults to ''en''.';
