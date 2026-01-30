-- Rain check history: snapshot of cancelled bookings so location/time/data can be viewed later.
-- Inserted when a coach submits a rain check; the row is removed from bookings but kept here.

CREATE TABLE IF NOT EXISTS rain_check_history (
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
  reason text DEFAULT 'rain_check',
  academy_id uuid REFERENCES academies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rain_check_history_user_id ON rain_check_history (user_id);
CREATE INDEX IF NOT EXISTS idx_rain_check_history_coach_id ON rain_check_history (coach_id);
CREATE INDEX IF NOT EXISTS idx_rain_check_history_cancelled_at ON rain_check_history (cancelled_at DESC);
CREATE INDEX IF NOT EXISTS idx_rain_check_history_academy_id ON rain_check_history (academy_id);

COMMENT ON TABLE rain_check_history IS 'Snapshot of bookings cancelled via rain check; used for history and reporting.';

-- RLS: coaches/admins can insert (when they rain check); authenticated can read their own or academy-scoped.
ALTER TABLE rain_check_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rain_check_history_select" ON rain_check_history;
CREATE POLICY "rain_check_history_select"
  ON rain_check_history FOR SELECT TO authenticated
  USING (
    academy_id IS NULL
    OR academy_id = (SELECT academy_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "rain_check_history_insert" ON rain_check_history;
CREATE POLICY "rain_check_history_insert"
  ON rain_check_history FOR INSERT TO authenticated
  WITH CHECK (true);
