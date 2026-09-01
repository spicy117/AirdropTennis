# Admin manual credit adjustment

Manual credit changes use the **same balance** as member Top Up and booking deductions:

| What | Where |
|------|--------|
| Balance | `profiles.wallet_balance` (numeric **dollars**, e.g. `200.02`) |
| Top up | Stripe → `credit_stripe_session` / `add_wallet_balance` |
| Booking charge | `deduct_wallet_balance` (Edge Function) |
| Admin manual adjust | `admin_adjust_wallet` RPC + `wallet_transactions` audit row |

## Required SQL (one time)

Supabase project **`rozxeqqwxpnfqbyvtvch`** → **SQL Editor** → run the full file:

`supabase/migrations/015_admin_wallet_ledger.sql`

If you already ran an older copy of 015, also run:

`supabase/migrations/016_admin_wallet_insert_policy.sql`

This creates:

- `wallet_transactions` audit table
- `is_admin()` helper
- `admin_adjust_wallet(p_user_id, p_amount, p_direction, p_reason, p_note)` RPC

## Verify

In SQL Editor:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'admin_adjust_wallet';
```

Should return one row.

## Test

1. Admin → Students → Adjust credits → Add `$10.00`
2. Balance should increase; `wallet_transactions` gets a row with `source = manual_admin_adjustment`
3. Member home **Credit Balance** should match after refresh

## If adjustment still fails

Open browser devtools → Console. Look for `Credit adjustment failed` with `code` / `message`:

| Code / message | Meaning |
|----------------|---------|
| `PGRST202` / function not found | Run migration 015 |
| `permission_denied` | Admin academy mismatch or not admin |
| `insufficient_balance` | Remove would go below $0 |
| `user_not_found` | Student profile missing |
