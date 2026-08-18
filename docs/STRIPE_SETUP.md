# Stripe checkout (wallet top-up + lesson payment)

The app calls the Edge Function **`dynamic-task`**. On the new Supabase project that function was **missing** (404), which shows up in the browser as a CORS error.

## 1. SQL (Supabase → SQL Editor)

Run `supabase/migrations/011_wallet_rpcs.sql`.

Also confirm `profiles` has `wallet_balance` (numeric). If not:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_balance numeric NOT NULL DEFAULT 0;
```

## 2. Stripe keys

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → API keys**
2. Copy **Secret key** (`sk_test_...` or `sk_live_...`)
3. Publishable key (`pk_...`) must be in **Vercel** as `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## 3. Deploy Edge Functions (Dashboard)

### `dynamic-task`

1. **Edge Functions → Create** → name: `dynamic-task`
2. Paste `supabase/functions/dynamic-task/index.ts`
3. JWT verification: **ON**
4. Deploy

### `deduct-wallet`

Same for `supabase/functions/deduct-wallet/index.ts` (wallet payments when balance is enough).

## 4. Secrets

**Project Settings → Edge Functions → Secrets**

| Name | Value |
|------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` |
| `APP_URL` | `https://app.airdroptennis.com` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are usually injected automatically.

## 5. Test

1. Student home → **Top Up** → $25 → **Proceed to Payment**
2. Should redirect to Stripe Checkout (not a CORS error)
3. After pay, return to `/home?session_id=...` and balance updates

## CORS note

`Access to fetch ... blocked by CORS` here meant the **function URL 404’d** on OPTIONS. Deploying `dynamic-task` fixes that.
