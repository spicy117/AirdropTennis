# Admin manual credit adjustment

Balance: **`profiles.wallet_balance`** (dollars). Stripe top-up is **unchanged** (`credit_stripe_session`).

## Fix adjust credits (run once)

Supabase → **SQL Editor** → run **only this file**:

**`supabase/migrations/021_wallet_transactions_recreate.sql`**

This backs up your old `wallet_transactions` table (legacy schema) to `wallet_transactions_legacy`, creates the correct audit table, and installs `admin_adjust_wallet`.

### Edge Function (once)

Deploy **`admin-adjust-wallet`** from `supabase/functions/admin-adjust-wallet/index.ts` (JWT **ON**).

### App

Vercel deploys automatically from `main` — no extra step if the latest build succeeded.

## Test

Admin → **Students** → **Adjust credits** → Add $10 → Confirm.

## Stripe

Member **Top Up** still uses `dynamic-task` + `credit_stripe_session`. Not affected by this migration.
