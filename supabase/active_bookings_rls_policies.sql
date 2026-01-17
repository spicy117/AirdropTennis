-- Row Level Security (RLS) policies for Active Bookings feature
-- These policies ensure only admins can access booking data for coach assignment

-- Policy: Only admins can view bookings for coach assignment
-- This prevents non-admins from querying bookings data
CREATE POLICY "Only admins can view bookings for coach assignment"
  ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Only admins can update coach_id in bookings
CREATE POLICY "Only admins can update coach assignments"
  ON bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Note: If you already have RLS policies on bookings table, you may need to
-- modify them or use a more specific policy name. Check existing policies first:
-- SELECT * FROM pg_policies WHERE tablename = 'bookings';

-- Alternative: Create a database function that enforces admin check server-side
CREATE OR REPLACE FUNCTION get_active_bookings_for_admin()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  location_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  coach_id UUID,
  credit_cost NUMERIC,
  service_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Server-side admin check
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Administrator role required';
  END IF;

  -- Return all bookings
  RETURN QUERY
  SELECT 
    b.id,
    b.user_id,
    b.location_id,
    b.start_time,
    b.end_time,
    b.coach_id,
    b.credit_cost,
    b.service_name,
    b.created_at,
    b.updated_at
  FROM bookings b;
END;
$$;

-- Grant execute permission to authenticated users (RLS will check admin role)
GRANT EXECUTE ON FUNCTION get_active_bookings_for_admin() TO authenticated;

-- Function to update coach assignment (with admin check)
CREATE OR REPLACE FUNCTION update_booking_coach(
  booking_ids UUID[],
  new_coach_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Server-side admin check
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: Administrator role required'
    );
  END IF;

  -- Update bookings
  UPDATE bookings
  SET coach_id = new_coach_id,
      updated_at = NOW()
  WHERE id = ANY(booking_ids);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Coach assignment updated successfully'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_booking_coach(UUID[], UUID) TO authenticated;
