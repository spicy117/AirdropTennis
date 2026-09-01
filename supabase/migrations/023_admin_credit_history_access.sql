-- Admin credit history: table grants + RLS fixes for wallet_transactions and stripe_processed_sessions.
-- Run in Supabase SQL Editor if credit history shows empty for admins.

GRANT SELECT ON TABLE public.wallet_transactions TO authenticated;
GRANT SELECT ON TABLE public.stripe_processed_sessions TO authenticated;

DROP POLICY IF EXISTS "wallet_transactions_admin_select" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_admin_select"
  ON public.wallet_transactions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.profiles admin_p
      CROSS JOIN public.profiles target_p
      WHERE admin_p.id = auth.uid()
        AND target_p.id = wallet_transactions.user_id
        AND (
          admin_p.academy_id IS NULL
          OR target_p.academy_id IS NULL
          OR admin_p.academy_id = target_p.academy_id
        )
    )
  );

DROP POLICY IF EXISTS "stripe_processed_sessions_admin_select" ON public.stripe_processed_sessions;
CREATE POLICY "stripe_processed_sessions_admin_select"
  ON public.stripe_processed_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.profiles admin_p
      CROSS JOIN public.profiles target_p
      WHERE admin_p.id = auth.uid()
        AND target_p.id = stripe_processed_sessions.user_id
        AND (
          admin_p.academy_id IS NULL
          OR target_p.academy_id IS NULL
          OR admin_p.academy_id = target_p.academy_id
        )
    )
  );

NOTIFY pgrst, 'reload schema';
