-- Fix legacy wallet_transactions tables that require `amount` (NOT NULL) instead of/in addition to `delta`.
-- Safe to re-run. Run in Supabase SQL Editor if credit adjustment fails with:
--   null value in column "amount" of relation "wallet_transactions"

ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS delta numeric;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_before numeric;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_after numeric;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS direction text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.wallet_transactions
  ALTER COLUMN source SET DEFAULT 'manual_admin_adjustment';

UPDATE public.wallet_transactions
SET delta = CASE
  WHEN direction = 'remove' THEN -abs(COALESCE(amount, 0))
  ELSE abs(COALESCE(amount, 0))
END
WHERE delta IS NULL AND amount IS NOT NULL;

UPDATE public.wallet_transactions
SET amount = abs(COALESCE(delta, 0))
WHERE amount IS NULL AND delta IS NOT NULL;

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
  v_has_amount boolean;
  v_has_delta boolean;
  v_has_balance_before boolean;
  v_has_balance_after boolean;
  v_has_direction boolean;
  v_has_reason boolean;
  v_has_note boolean;
  v_has_source boolean;
  v_has_created_by boolean;
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

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'amount'
  ) INTO v_has_amount;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'delta'
  ) INTO v_has_delta;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'balance_before'
  ) INTO v_has_balance_before;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'balance_after'
  ) INTO v_has_balance_after;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'direction'
  ) INTO v_has_direction;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'reason'
  ) INTO v_has_reason;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'note'
  ) INTO v_has_note;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'source'
  ) INTO v_has_source;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'created_by'
  ) INTO v_has_created_by;

  IF v_has_amount AND v_has_delta AND v_has_balance_before AND v_has_balance_after
     AND v_has_direction AND v_has_reason THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, delta, balance_before, balance_after, direction, reason, note, source, created_by
    ) VALUES (
      p_user_id, p_amount, v_delta, v_current, v_new, p_direction, p_reason,
      nullif(btrim(p_note), ''),
      CASE WHEN v_has_source THEN 'manual_admin_adjustment' ELSE NULL END,
      CASE WHEN v_has_created_by THEN v_admin_id ELSE NULL END
    )
    RETURNING id INTO v_tx_id;
  ELSIF v_has_amount AND v_has_reason THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, reason, source, created_by
    ) VALUES (
      p_user_id, p_amount, p_reason, 'manual_admin_adjustment', v_admin_id
    )
    RETURNING id INTO v_tx_id;
  ELSE
    RAISE EXCEPTION 'wallet_transactions_schema_unsupported';
  END IF;

  RETURN QUERY SELECT v_tx_id, v_current, v_new, v_delta;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
