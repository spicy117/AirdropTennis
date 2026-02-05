-- User cancellation history: snapshot of bookings cancelled by the user (free cancel or approved cancel request).
-- Inserted when a user cancels (free window) or when admin approves a cancellation request.
-- Used for history, reporting, and triggering notifications to admin + coach.

CREATE TABLE IF NOT EXISTS user_cancellation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_booking_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  location_name text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  service_name text,
  credit_cost numeric DEFAULT 0,
  cancelled_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  academy_id uuid REFERENCES academies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_cancellation_history_user_id ON user_cancellation_history (user_id);
CREATE INDEX IF NOT EXISTS idx_user_cancellation_history_coach_id ON user_cancellation_history (coach_id);
CREATE INDEX IF NOT EXISTS idx_user_cancellation_history_cancelled_at ON user_cancellation_history (cancelled_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_cancellation_history_academy_id ON user_cancellation_history (academy_id);

COMMENT ON TABLE user_cancellation_history IS 'Snapshot of bookings cancelled by user; used for history and admin/coach notifications.';

-- RLS: authenticated can insert (when cancelling); read by academy-scoped users.
ALTER TABLE user_cancellation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_cancellation_history_select" ON user_cancellation_history;
CREATE POLICY "user_cancellation_history_select"
  ON user_cancellation_history FOR SELECT TO authenticated
  USING (
    academy_id IS NULL
    OR academy_id = (SELECT academy_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "user_cancellation_history_insert" ON user_cancellation_history;
CREATE POLICY "user_cancellation_history_insert"
  ON user_cancellation_history FOR INSERT TO authenticated
  WITH CHECK (true);
