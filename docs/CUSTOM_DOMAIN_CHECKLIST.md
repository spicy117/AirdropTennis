# Custom Domain Checklist

When you point your app to a custom DNS (e.g. `app.airdroptennis.com` instead of `localhost` or a default host), use this checklist so nothing breaks.

---

## 1. Supabase Dashboard (Auth redirects)

- **Authentication → URL Configuration**
  - **Site URL:** Set to your app’s canonical URL, e.g. `https://app.airdroptennis.com`
  - **Redirect URLs:** Add your custom origin so Supabase allows redirects back:
    - `https://app.airdroptennis.com`
    - `https://app.airdroptennis.com/**`
    - (Add `http://...` too if you use it for testing.)

Without this, email confirmation and password reset links may redirect to the wrong host or be rejected.

---

## 2. App code – what adapts automatically

These already use **`window.location.origin`**, so they work on any domain (including your custom one) without code changes:

- **AuthContext.js:** `emailRedirectTo` and reset-password `redirectTo` use `window.location.origin`.
- **App.js / HomeScreen.js:** Stripe `session_id` handling and URL cleanup use `window.location.pathname` / `replaceState` (path-only), so they work on any host.

No edits required here when you switch to a custom domain.

---

## 3. App code – optional / if you use them

- **`lib/supabase.js`** and **`screens/AdminCoachesScreen.js`**  
  These hardcode the **Supabase project URL** (`https://qdlzumzkhbnxpkprbuju.supabase.co`).  
  That is your **Supabase API URL**, not your app’s domain. You only change it if Supabase gives you a custom API domain; otherwise leave it as-is.

- **`contexts/AcademyContext.js`**  
  `getSubdomainFromHost()` treats `localhost` and `127.0.0.1` as “no subdomain”.  
  If your custom domain is something like `app.airdroptennis.com` and you want “app” to be treated as the main app (no academy subdomain), add your production host (e.g. `app.airdroptennis.com`) to the logic or to a list of “root” hosts so it doesn’t get parsed as a subdomain.

- **`middleware.ts`** (if you use Next.js / this middleware)  
  `ROOT_HOSTS` includes `localhost`, `127.0.0.1`, `servestream.com`.  
  If you serve the app at a custom domain and don’t want the first segment to be treated as a subdomain, add that domain (or host) to `ROOT_HOSTS` or adjust `getSubdomain()`.

---

## 4. Stripe (payments)

- If **Stripe Checkout** success/cancel URLs are set in your **backend or Edge Function** (e.g. when creating the Checkout Session), set them to your custom domain, e.g.:
  - Success: `https://app.airdroptennis.com/home?session_id={CHECKOUT_SESSION_ID}` (or the path your app uses)
  - Cancel: `https://app.airdroptennis.com/home` (or the path you want after cancel)
- If success/cancel URLs are built from the request (e.g. from `Referer` or a front-end env), point that env or logic at your custom domain.

---

## 5. Environment variables

- **`.env`**  
  Currently only `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is used. No app URL is hardcoded there.  
  If you add something like `EXPO_PUBLIC_APP_URL=https://app.airdroptennis.com`, use it only where you explicitly need a fixed origin (e.g. sharing links); the app already uses `window.location.origin` for auth and redirects.

---

## 6. DNS and hosting

- Point your **custom DNS** (e.g. `app.airdroptennis.com`) to the host that serves the app (e.g. Vercel, Netlify, or your Expo web build).
- Ensure **HTTPS** is enabled so Supabase and Stripe redirects stay secure.

---

## Quick summary

| Item                         | Action |
|-----------------------------|--------|
| Supabase Site URL           | Set to `https://your-custom-domain.com` |
| Supabase Redirect URLs      | Add `https://your-custom-domain.com` and `https://your-custom-domain.com/**` |
| AuthContext / redirects     | No change (use `window.location.origin`) |
| Supabase API URL in code    | Leave as-is unless Supabase gives you a custom API domain |
| Stripe success/cancel URLs | Set to your custom domain in backend/Edge Function (if used) |
| Academy/middleware subdomain| Adjust if you use a single custom host like `app.example.com` |
| DNS + HTTPS                 | Point domain to app host; enable SSL |
