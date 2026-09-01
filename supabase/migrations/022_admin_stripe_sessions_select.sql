-- Allow admins to read successful Stripe top-up records for student credit history.
-- Does not change payment or crediting logic.

GRANT SELECT ON TABLE public.stripe_processed_sessions TO authenticated;

DROP POLICY IF EXISTS "stripe_processed_sessions_admin_select" ON public.stripe_processed_sessions;
CREATE POLICY "stripe_processed_sessions_admin_select"
  ON public.stripe_processed_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.profiles target_p
      WHERE target_p.id = stripe_processed_sessions.user_id
        AND (
          target_p.academy_id IS NULL
          OR target_p.academy_id = public.user_academy_id()
        )
    )
  );
