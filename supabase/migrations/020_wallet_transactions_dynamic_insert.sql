-- Dynamic wallet audit insert for legacy wallet_transactions schemas.
-- Handles amount, transaction_type, and other NOT NULL columns automatically.
-- Safe to re-run. Run in Supabase SQL Editor when credit adjustment fails on audit insert.

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
  v_tx_type text;
  col record;
  v_cols text[] := '{}';
  v_vals text[] := '{}';
  v_lit text;
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

  v_tx_type := CASE WHEN p_direction = 'add' THEN 'credit' ELSE 'debit' END;

  FOR col IN
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wallet_transactions'
      AND column_name <> 'id'
    ORDER BY ordinal_position
  LOOP
    v_lit := NULL;

    CASE col.column_name
      WHEN 'user_id' THEN v_lit := format('%L', p_user_id);
      WHEN 'amount' THEN v_lit := p_amount::text;
      WHEN 'delta' THEN v_lit := v_delta::text;
      WHEN 'balance_before' THEN v_lit := v_current::text;
      WHEN 'balance_after' THEN v_lit := v_new::text;
      WHEN 'balance' THEN v_lit := v_new::text;
      WHEN 'direction' THEN v_lit := format('%L', p_direction);
      WHEN 'reason' THEN v_lit := format('%L', p_reason);
      WHEN 'note' THEN
        IF p_note IS NOT NULL AND btrim(p_note) <> '' THEN
          v_lit := format('%L', btrim(p_note));
        END IF;
      WHEN 'source' THEN v_lit := format('%L', 'manual_admin_adjustment');
      WHEN 'created_by' THEN v_lit := format('%L', v_admin_id);
      WHEN 'admin_id' THEN v_lit := format('%L', v_admin_id);
      WHEN 'transaction_type' THEN v_lit := format('%L', v_tx_type);
      WHEN 'type' THEN v_lit := format('%L', 'manual_admin_adjustment');
      WHEN 'description' THEN v_lit := format('%L', p_reason);
      WHEN 'metadata' THEN v_lit := NULL;
      WHEN 'created_at' THEN
        v_cols := array_append(v_cols, col.column_name);
        v_vals := array_append(v_vals, 'now()');
        CONTINUE;
      ELSE
        v_lit := NULL;
    END CASE;

    IF v_lit IS NOT NULL THEN
      v_cols := array_append(v_cols, col.column_name);
      v_vals := array_append(v_vals, v_lit);
    ELSIF col.is_nullable = 'NO' AND col.column_default IS NULL THEN
      RAISE EXCEPTION 'wallet_column_unmapped:%', col.column_name;
    END IF;
  END LOOP;

  IF array_length(v_cols, 1) IS NULL THEN
    RAISE EXCEPTION 'wallet_transactions_schema_unsupported';
  END IF;

  EXECUTE format(
    'INSERT INTO public.wallet_transactions (%s) VALUES (%s) RETURNING id',
    array_to_string(v_cols, ', '),
    array_to_string(v_vals, ', ')
  )
  INTO v_tx_id;

  RETURN QUERY SELECT v_tx_id, v_current, v_new, v_delta;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
