-- Atomic Stripe wallet credit. Safe to re-run.
-- Marks a Checkout session processed AND adds to wallet in the same transaction,
-- so a session cannot be "used up" without the balance actually changing.

CREATE TABLE IF NOT EXISTS public.stripe_processed_sessions (
  session_id text PRIMARY KEY,
  user_id uuid,
  amount numeric,
  type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_processed_sessions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.stripe_processed_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.credit_stripe_session(
  p_session_id text,
  p_user_id uuid,
  p_amount numeric,
  p_type text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_bal numeric;
  inserted_count integer;
BEGIN
  IF p_session_id IS NULL OR btrim(p_session_id) = '' THEN
    RAISE EXCEPTION 'session required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;

  INSERT INTO public.stripe_processed_sessions (session_id, user_id, amount, type)
  VALUES (p_session_id, p_user_id, COALESCE(p_amount, 0), COALESCE(p_type, 'topup'))
  ON CONFLICT (session_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  SELECT COALESCE(wallet_balance, 0)
    INTO new_bal
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  -- Only the first successful insert credits. Later retries return current balance.
  IF inserted_count > 0
     AND COALESCE(p_amount, 0) > 0
     AND COALESCE(p_type, 'topup') = 'topup' THEN
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
    WHERE id = p_user_id
    RETURNING wallet_balance INTO new_bal;
  END IF;

  RETURN COALESCE(new_bal, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_stripe_session(text, uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_stripe_session(text, uuid, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_stripe_session(text, uuid, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_stripe_session(text, uuid, numeric, text) TO service_role;
