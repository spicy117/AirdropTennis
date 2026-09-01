# Admin manual credit adjustment

Balance lives on **`profiles.wallet_balance`** (numeric dollars). Manual adjustments use **`admin_adjust_wallet`** RPC + **`wallet_transactions`** audit row.

## Setup (required once)

Supabase project **`rozxeqqwxpnfqbyvtvch`**:

### 1. SQL Editor

Run **020** (latest fix for legacy audit table columns):

`supabase/migrations/020_wallet_transactions_dynamic_insert.sql`

If you have not run any wallet migration yet, use `018_admin_wallet_complete.sql` first, then **020**.

This creates/repairs `wallet_transactions`, `is_admin()`, and `admin_adjust_wallet`, then reloads the API schema cache.

Verify:

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'admin_adjust_wallet';
```

### 2. Edge Function `admin-adjust-wallet`

1. Edge Functions → **Create** → name: `admin-adjust-wallet`
2. Paste `supabase/functions/admin-adjust-wallet/index.ts`
3. **Verify JWT: ON** → Deploy

The app calls this function (not the RPC directly). It verifies the admin JWT, then runs `admin_adjust_wallet`.

## Test

Admin → **Students** → **Adjust credits** → Add `$10.00`.

Expected: balance updates, row in `wallet_transactions`, member home shows the same balance.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Generic “Credit could not be updated” | Run SQL step 1 + deploy Edge Function step 2 |
| `column "created_by" does not exist` | Run `018_admin_wallet_complete.sql` (repairs partial table) |
| Edge function 404 | Deploy `admin-adjust-wallet` on the **same** Supabase project as the app |
