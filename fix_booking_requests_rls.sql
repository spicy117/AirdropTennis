-- Fix RLS policy for booking_requests table to allow students to create rain check requests
-- Run this in Supabase SQL Editor

-- First, drop the existing INSERT policy if it exists (adjust name if different)
DROP POLICY IF EXISTS "Users can insert booking requests for their own bookings" ON booking_requests;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON booking_requests;
DROP POLICY IF EXISTS "booking_requests_insert_policy" ON booking_requests;

-- Create the new policy that allows users to insert booking requests for their own bookings
-- The policy checks that:
-- 1. The booking belongs to the user (bookings.user_id = auth.uid())
-- 2. The requested_by matches the authenticated user (requested_by = auth.uid())
CREATE POLICY "Users can insert booking requests for their own bookings"
ON booking_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = booking_requests.booking_id 
    AND bookings.user_id = auth.uid()
  )
);

-- Also ensure users can read their own booking requests
DROP POLICY IF EXISTS "Users can read their own booking requests" ON booking_requests;

CREATE POLICY "Users can read their own booking requests"
ON booking_requests
FOR SELECT
TO authenticated
USING (
  requested_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = booking_requests.booking_id 
    AND bookings.user_id = auth.uid()
  )
);
