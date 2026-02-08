-- Add baseline skills for first-ever assessment (for radar chart comparison)
ALTER TABLE student_performance
  ADD COLUMN IF NOT EXISTS baseline_skills jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS baseline_assessed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN student_performance.baseline_skills IS 'First-ever assessment values; used as dotted baseline on radar chart';
COMMENT ON COLUMN student_performance.baseline_assessed_at IS 'When baseline was first recorded';

-- Backfill: existing rows get baseline = current skills (we have no history)
UPDATE student_performance
SET baseline_skills = skills, baseline_assessed_at = created_at
WHERE baseline_skills IS NULL AND skills IS NOT NULL;

-- Trigger: on first insert, set baseline from skills if not provided
CREATE OR REPLACE FUNCTION student_performance_set_baseline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.baseline_skills IS NULL AND NEW.skills IS NOT NULL THEN
    NEW.baseline_skills := NEW.skills;
    NEW.baseline_assessed_at := COALESCE(NEW.baseline_assessed_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_student_performance_set_baseline ON student_performance;
CREATE TRIGGER trg_student_performance_set_baseline
  BEFORE INSERT ON student_performance
  FOR EACH ROW
  EXECUTE PROCEDURE student_performance_set_baseline();
