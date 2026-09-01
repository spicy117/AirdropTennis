-- Admin wallet ledger + secure manual credit adjustments. Safe to re-run.

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

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  direction text NOT NULL CHECK (direction IN ('add', 'remove')),
  reason text NOT NULL,
  note text,
  source text NOT NULL DEFAULT 'manual_admin_adjustment',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_id_created_at_idx
  ON public.wallet_transactions (user_id, created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_transactions_admin_select" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_admin_select"
  ON public.wallet_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid()
        AND admin_p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles target_p
      WHERE target_p.id = wallet_transactions.user_id
        AND (
          target_p.academy_id IS NULL
          OR target_p.academy_id = public.user_academy_id()
        )
    )
  );

-- Allow audit inserts from admin_adjust_wallet when RLS applies to SECURITY DEFINER callers.
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

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_direction text,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS TABLE (
  transaction_id uuid,
  balance_before numeric,
  balance_after numeric,
  delta numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_current numeric;
  v_delta numeric;
  v_new numeric;
  v_tx_id uuid;
  v_target_academy uuid;
  v_admin_academy uuid;
BEGIN
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_direction NOT IN ('add', 'remove') THEN
    RAISE EXCEPTION 'invalid_direction';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  IF p_reason = 'Other' AND (p_note IS NULL OR btrim(p_note) = '') THEN
    RAISE EXCEPTION 'note_required_for_other';
  END IF;

  SELECT academy_id INTO v_admin_academy FROM public.profiles WHERE id = v_admin_id;

  SELECT wallet_balance, academy_id
    INTO v_current, v_target_academy
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_admin_academy IS NOT NULL
     AND v_target_academy IS NOT NULL
     AND v_admin_academy <> v_target_academy THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  v_current := COALESCE(v_current, 0);
  v_delta := CASE WHEN p_direction = 'add' THEN p_amount ELSE -p_amount END;
  v_new := round((v_current + v_delta)::numeric, 2);

  IF v_new < 0 THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = v_new
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  INSERT INTO public.wallet_transactions (
    user_id,
    delta,
    balance_before,
    balance_after,
    direction,
    reason,
    note,
    source,
    created_by
  ) VALUES (
    p_user_id,
    v_delta,
    v_current,
    v_new,
    p_direction,
    p_reason,
    nullif(btrim(p_note), ''),
    'manual_admin_adjustment',
    v_admin_id
  )
  RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_tx_id, v_current, v_new, v_delta;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text, text) TO authenticated;
