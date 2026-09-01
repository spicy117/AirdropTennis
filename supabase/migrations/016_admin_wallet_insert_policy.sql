-- Patch for projects that ran an earlier 015 without wallet_transactions INSERT policy.
-- Safe to re-run. Also safe if full 015 was applied later.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "wallet_transactions_admin_insert" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_admin_insert"
  ON public.wallet_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND created_by = auth.uid()
    AND source = 'manual_admin_adjustment'
  );
