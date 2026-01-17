-- Add coach_id field to bookings table that references profiles.id
-- This allows a booking to have an optional assigned coach

-- Add coach_id column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for faster queries on coach_id
CREATE INDEX IF NOT EXISTS idx_bookings_coach_id ON bookings(coach_id);

-- Add a check constraint to ensure coach_id references a profile with role 'coach' or 'admin'
-- Note: This is a soft constraint - we'll rely on application logic to enforce this
-- A database-level check would require a function, which is more complex
-- For now, we'll add a comment documenting this requirement
COMMENT ON COLUMN bookings.coach_id IS 'Optional reference to profiles.id. Should reference a profile with role ''coach'' or ''admin''.';
