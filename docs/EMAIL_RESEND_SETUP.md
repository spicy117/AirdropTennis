# Email setup with Resend (signup, password reset, welcome)

---

## Emails not working? Start here

**Most common cause:** the `auth-send-email` Edge Function was never deployed, or the Send Email hook is enabled but pointing at a dead URL — then **zero** auth emails go out.

Check: open  
`https://rozxeqqwxpnfqbyvtvch.supabase.co/functions/v1/auth-send-email`  
→ if you see **404**, the function is not deployed.

### Fastest fix (~5 min): Resend SMTP (no Edge Function)

1. Supabase → **Authentication → Hooks** → if **Send Email** hook exists → **Disable or delete it** (hook + no function = no mail).
2. Supabase → **Project Settings → Authentication → SMTP Settings** → enable **Custom SMTP**:

   | Field | Value |
   |-------|--------|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | User | `resend` |
   | Password | your Resend API key (`re_...`) |
   | Sender email | `onboarding@resend.dev` *(sandbox)* or `noreply@airdroptennis.com` *(after domain verified)* |
   | Sender name | `Airdrop Tennis` |

3. **Authentication → URL Configuration**
   - Site URL: `https://app.airdroptennis.com`
   - Redirect URLs: `https://app.airdroptennis.com/**`

4. **Authentication → Providers → Email** → Confirm email **on**.

5. Test: sign up with **jasper.kofkin1@gmail.com** (Resend sandbox only delivers to your Resend account email when using `onboarding@resend.dev`).

6. Check **Resend → Emails** and **Supabase → Authentication → Logs** if still nothing.

### Branded emails (later): deploy Edge Function + hook

See steps below. Only use the hook **after** the function returns something other than 404.

---

After migrating to a new Supabase project, **auth emails stop working** until you configure a mail provider. Supabase’s built-in email is rate-limited and unreliable in production.

This guide connects **Resend** so you can send and **track** all auth emails (signup confirmation, password reset, invites).

---

## Why emails stopped

Your app sends auth emails through **Supabase Auth**, not app code:

| Email | Triggered by |
|-------|----------------|
| Signup confirmation | `supabase.auth.signUp()` |
| Resend verification | `supabase.auth.resend()` |
| Password reset | `supabase.auth.resetPasswordForEmail()` |

The new project (`rozxeqqwxpnfqbyvtvch`) needs either:

1. **Custom SMTP** (Resend SMTP) in Supabase, or  
2. **Send Email hook** → Edge Function → Resend API (**recommended** — better templates + Resend dashboard tracking)

---

## Quick test (Resend sandbox — no custom domain yet)

If your domain isn’t verified yet, Resend lets you send **from** `onboarding@resend.dev` **to the email on your Resend account only**.

1. In Supabase → **Edge Functions** → **Secrets**, add:
   - `RESEND_API_KEY` = your `re_...` key
   - `RESEND_FROM_EMAIL` = `onboarding@resend.dev`
2. Deploy `auth-send-email` and enable the Send Email hook (steps below).
3. Sign up on the app using **the same email as your Resend account** (e.g. `jasper.kofkin1@gmail.com`).

Once `airdroptennis.com` is verified in Resend, switch to:
`RESEND_FROM_EMAIL` = `Airdrop Tennis <noreply@airdroptennis.com>`

> **Security:** Never commit API keys to git. Store only in Supabase secrets. If a key was shared in chat or code, rotate it in Resend → API Keys.

---

1. Sign up at [resend.com](https://resend.com).
2. **Domains** → Add `airdroptennis.com`.
3. Add the DNS records Resend shows (SPF, DKIM, etc.) at your DNS host.
4. Wait until the domain shows **Verified**.
5. **API Keys** → Create key → copy `re_...`.

Use a verified sender, e.g. `noreply@airdroptennis.com`.

---

## Step 2 — Deploy the auth email Edge Function

### Option A: Supabase Dashboard (no CLI)

1. **Edge Functions** → **Create function** → name: `auth-send-email`
2. Paste the code from `supabase/functions/auth-send-email/index.ts` in this repo.
3. **Deploy** with **JWT verification OFF** (auth hooks call this without a user JWT).
4. **Edge Functions → Secrets** → add:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` (use `onboarding@resend.dev` for sandbox testing)
5. Copy the function URL for the hook step below.

### Option B: Supabase CLI

From the project root (with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project):

```bash
supabase link --project-ref rozxeqqwxpnfqbyvtvch

supabase secrets set \
  RESEND_API_KEY=re_YOUR_KEY \
  RESEND_FROM_EMAIL="Airdrop Tennis <noreply@airdroptennis.com>"

supabase functions deploy auth-send-email --no-verify-jwt
```

Note the function URL, e.g.  
`https://rozxeqqwxpnfqbyvtvch.supabase.co/functions/v1/auth-send-email`

---

## Step 3 — Enable the Send Email hook

1. Supabase Dashboard → **Authentication** → **Hooks**.
2. **Send Email** → Create hook.
3. Type: **HTTPS**.
4. URL: your `auth-send-email` function URL from Step 2.
5. Click **Generate secret** → copy the full value (`v1,whsec_...`).

Set the secret:

```bash
supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_YOUR_SECRET"
```

Redeploy so the function picks up the secret:

```bash
supabase functions deploy auth-send-email --no-verify-jwt
```

Save the hook in the dashboard.

> Once the hook is enabled, Supabase **stops** using its built-in mailer for auth emails. All auth mail goes through Resend.

---

## Step 4 — Auth URL config (required for links to work)

**Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| Site URL | `https://app.airdroptennis.com` |
| Redirect URLs | `https://app.airdroptennis.com`, `https://app.airdroptennis.com/**` |

Without this, confirmation/reset links may point at the wrong host.

---

## Step 5 — Confirm email is enabled

**Authentication → Providers → Email**

- [x] Enable Email provider  
- [x] Confirm email (recommended for signup)  
- [ ] Disable “Confirm email” only if you want instant login without verification

---

## Step 6 — Test

1. Sign up with a **new** email on [app.airdroptennis.com](https://app.airdroptennis.com).
2. Check **Resend → Emails** for delivery status (sent, delivered, bounced).
3. Check **Supabase → Edge Functions → auth-send-email → Logs** if nothing arrives.
4. Test password reset from the login screen.

---

## Track emails in Resend

Resend dashboard shows for each message:

- Sent / delivered / bounced / complained  
- Subject, recipient, timestamp  
- Message ID (logged by our function as `resend_id`)

Filter by domain or search by recipient email.

---

## Alternative: SMTP only (no Edge Function)

If you prefer not to deploy the hook yet:

1. Resend → **SMTP** → copy credentials.
2. Supabase → **Project Settings → Authentication → SMTP Settings**:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (TLS)
   - User: `resend`
   - Password: your Resend API key
   - Sender: `noreply@airdroptennis.com`
3. Enable **Custom SMTP**.

Customize templates under **Authentication → Email Templates** (signup, recovery, etc.).

SMTP is simpler but templates are basic; the hook gives branded HTML and the same Resend tracking.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Nothing at all / 404 on function URL | **Disable Send Email hook** OR deploy `auth-send-email`. Use SMTP fix above. |
| No email at all | Hook enabled but function missing; or SMTP not configured. |
| 401 on hook | `SEND_EMAIL_HOOK_SECRET` doesn’t match dashboard secret. Redeploy after setting. |
| Email in spam | Complete SPF/DKIM on `airdroptennis.com` in Resend. |
| Link goes to wrong site | Fix Site URL + Redirect URLs (Step 4). |
| “Domain not verified” from Resend | Finish DNS verification in Resend. |
| Using `onboarding@resend.dev` | Only for testing; use your verified domain in production. |

---

## Files in this repo

| File | Purpose |
|------|---------|
| `supabase/functions/auth-send-email/index.ts` | Auth hook → Resend (signup, reset, magic link, invite) |
| `contexts/AuthContext.js` | Sets `emailRedirectTo` to current app origin |
| `docs/CUSTOM_DOMAIN_SETUP.md` | Site URL / redirect setup |
