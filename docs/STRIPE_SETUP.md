# Stripe checkout (wallet top-up + lesson payment)

Wallet credit is done **on the server** when Stripe redirects back. The browser is only used to show the new balance.

## 1. SQL (required)

Supabase → **SQL Editor** → run `supabase/migrations/013_credit_stripe_session.sql`.

This creates `credit_stripe_session`, which marks the Stripe session and adds to `profiles.wallet_balance` in one transaction.

## 2. Update `dynamic-task` (required)

1. Edge Functions → **dynamic-task** → paste `supabase/functions/dynamic-task/index.ts`
2. **Verify JWT: OFF**
3. Deploy

Secrets (already set if checkout itself works):

| Name | Value |
|------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` |
| `APP_URL` | `https://app.airdroptennis.com` |

After this, Stripe **success_url** is the Edge Function, which credits the wallet then sends the user to `/home?credited=1`.

## 3. Optional: Stripe Dashboard webhook

For people who close the tab before redirect.

1. Create function **stripe-webhook**, paste `supabase/functions/stripe-webhook/index.ts`, JWT **OFF**
2. Secret: `STRIPE_WEBHOOK_SECRET`
3. Stripe → Developers → Webhooks → Add endpoint  
   `https://rozxeqqwxpnfqbyvtvch.supabase.co/functions/v1/stripe-webhook`  
   Event: `checkout.session.completed`

## 4. Test

1. Student home → **Top Up** → pay in Stripe
2. You should land on the app with a success message
3. Credit Balance should match Table Editor → `profiles.wallet_balance`

If an old test payment was recorded in `stripe_processed_sessions` **without** crediting, delete that `session_id` row (new checkouts create a new id, so this only matters for retries of the same session).
