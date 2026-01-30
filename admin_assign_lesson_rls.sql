-- Allow admins to insert bookings for any student (used by "Assign lesson" feature).
-- Run this in Supabase SQL Editor if admin assign-lesson insert is denied by RLS.

-- Policy: admins can insert any row into bookings
DROP POLICY IF EXISTS "Admins can insert bookings for any user" ON bookings;
CREATE POLICY "Admins can insert bookings for any user"
ON bookings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
