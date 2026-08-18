-- V2 missing tables from the old project.
-- Run this in SQL Editor on project rozxeqqwxpnfqbyvtvch (Airdrop Tennis V2).
-- Safe to re-run.

-- =============================================================================
-- rain_check_history
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rain_check_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_booking_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  location_name text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  service_name text,
  credit_cost numeric DEFAULT 0,
  cancelled_at timestamptz NOT NULL DEFAULT now(),
  reason text DEFAULT 'rain_check',
  academy_id uuid REFERENCES public.academies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rain_check_history_user_id ON public.rain_check_history (user_id);
CREATE INDEX IF NOT EXISTS idx_rain_check_history_coach_id ON public.rain_check_history (coach_id);
CREATE INDEX IF NOT EXISTS idx_rain_check_history_cancelled_at ON public.rain_check_history (cancelled_at DESC);
CREATE INDEX IF NOT EXISTS idx_rain_check_history_academy_id ON public.rain_check_history (academy_id);

ALTER TABLE public.rain_check_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rain_check_history_select" ON public.rain_check_history;
CREATE POLICY "rain_check_history_select"
  ON public.rain_check_history FOR SELECT TO authenticated
  USING (
    academy_id IS NULL
    OR academy_id = (SELECT academy_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "rain_check_history_insert" ON public.rain_check_history;
CREATE POLICY "rain_check_history_insert"
  ON public.rain_check_history FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================================================
-- user_cancellation_history
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_cancellation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_booking_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  location_name text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  service_name text,
  credit_cost numeric DEFAULT 0,
  cancelled_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  academy_id uuid REFERENCES public.academies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_cancellation_history_user_id ON public.user_cancellation_history (user_id);
CREATE INDEX IF NOT EXISTS idx_user_cancellation_history_coach_id ON public.user_cancellation_history (coach_id);
CREATE INDEX IF NOT EXISTS idx_user_cancellation_history_cancelled_at ON public.user_cancellation_history (cancelled_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_cancellation_history_academy_id ON public.user_cancellation_history (academy_id);

ALTER TABLE public.user_cancellation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_cancellation_history_select" ON public.user_cancellation_history;
CREATE POLICY "user_cancellation_history_select"
  ON public.user_cancellation_history FOR SELECT TO authenticated
  USING (
    academy_id IS NULL
    OR academy_id = (SELECT academy_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "user_cancellation_history_insert" ON public.user_cancellation_history;
CREATE POLICY "user_cancellation_history_insert"
  ON public.user_cancellation_history FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================================================
-- student_performance (Skills Profile / Coach insight)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.student_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skills jsonb NOT NULL DEFAULT '{"serve":0,"forehand":0,"backhand":0,"volleys":0,"fitness":0,"consistency":0}'::jsonb,
  focus_area text DEFAULT '',
  coach_insight text DEFAULT '',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.student_performance
  ADD COLUMN IF NOT EXISTS baseline_skills jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS baseline_assessed_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_student_performance_user_id ON public.student_performance (user_id);

ALTER TABLE public.student_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_performance_select" ON public.student_performance;
CREATE POLICY "student_performance_select"
  ON public.student_performance FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach'))
  );

DROP POLICY IF EXISTS "student_performance_insert" ON public.student_performance;
CREATE POLICY "student_performance_insert"
  ON public.student_performance FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach'))
  );

DROP POLICY IF EXISTS "student_performance_update" ON public.student_performance;
CREATE POLICY "student_performance_update"
  ON public.student_performance FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach'))
  );

CREATE OR REPLACE FUNCTION public.student_performance_set_baseline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.baseline_skills IS NULL AND NEW.skills IS NOT NULL THEN
    NEW.baseline_skills := NEW.skills;
    NEW.baseline_assessed_at := COALESCE(NEW.baseline_assessed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_performance_set_baseline ON public.student_performance;
CREATE TRIGGER trg_student_performance_set_baseline
  BEFORE INSERT ON public.student_performance
  FOR EACH ROW
  EXECUTE FUNCTION public.student_performance_set_baseline();
