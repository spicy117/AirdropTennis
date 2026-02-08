-- Student performance data for Coach's Insight and Skills Profile
-- Used by admin/coach Performance Management tab

CREATE TABLE IF NOT EXISTS student_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skills jsonb NOT NULL DEFAULT '{"serve":0,"forehand":0,"backhand":0,"volleys":0,"fitness":0,"consistency":0}'::jsonb,
  focus_area text DEFAULT '',
  coach_insight text DEFAULT '',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_student_performance_user_id ON student_performance (user_id);

COMMENT ON TABLE student_performance IS 'Coach/admin edits: skills radar, focus area, technical feedback per student';

-- RLS: admins and coaches can read/write; students can read their own only
ALTER TABLE student_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_performance_select" ON student_performance;
CREATE POLICY "student_performance_select"
  ON student_performance FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach'))
  );

DROP POLICY IF EXISTS "student_performance_insert" ON student_performance;
CREATE POLICY "student_performance_insert"
  ON student_performance FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach'))
  );

DROP POLICY IF EXISTS "student_performance_update" ON student_performance;
CREATE POLICY "student_performance_update"
  ON student_performance FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach'))
  );
