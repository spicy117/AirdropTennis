-- Wallet RPCs used by Stripe Edge Functions and admin refunds.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.add_wallet_balance(user_id uuid, amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_bal numeric;
BEGIN
  IF amount IS NULL OR amount = 0 THEN
    SELECT wallet_balance INTO new_bal FROM public.profiles WHERE id = user_id;
    RETURN COALESCE(new_bal, 0);
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + amount
  WHERE id = user_id
  RETURNING wallet_balance INTO new_bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  RETURN new_bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_wallet_balance(user_id uuid, amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_bal numeric;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - amount
  WHERE id = user_id
    AND COALESCE(wallet_balance, 0) >= amount
  RETURNING wallet_balance INTO new_bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  RETURN new_bal;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_wallet_balance(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wallet_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_balance(uuid, numeric) TO service_role;

CREATE TABLE IF NOT EXISTS public.stripe_processed_sessions (
  session_id text PRIMARY KEY,
  user_id uuid,
  amount numeric,
  type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_processed_sessions ENABLE ROW LEVEL SECURITY;
