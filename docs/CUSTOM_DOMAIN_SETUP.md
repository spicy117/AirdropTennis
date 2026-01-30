# How to Move Your App to a Custom DNS

Step-by-step guide to serve your app on a custom domain (e.g. `app.airdroptennis.com`).

---

## 1. Have a domain and a place to host the app

- **Domain:** You need a domain (e.g. from Namecheap, Google Domains, Cloudflare, GoDaddy).  
  Decide the hostname you’ll use for the app, e.g. `app.airdroptennis.com` or `book.airdroptennis.com`.

- **Hosting:** Your Expo web app must be deployed somewhere that supports custom domains and HTTPS. Common options:
  - **Vercel** (recommended for Expo web)
  - **Netlify**
  - **Cloudflare Pages**
  - **Expo EAS** (if you use EAS for web)

---

## 2. Build and deploy the web app

From your project root:

```bash
npm install
npx expo export --platform web
```

This creates a `dist/` folder with static files. (Expo 54 uses Metro; do not use `expo export:web` — it will fail.)

- **Vercel:** Connect your repo to Vercel, set **Build Command** to `npx expo export --platform web`, **Output Directory** to `dist` (or whatever Expo outputs; check the CLI message). Deploy.
- **Netlify:** Same idea: build command `npx expo export --platform web`, publish directory = output folder from Expo.
- **Manual:** Upload the contents of the export folder to any static host (S3 + CloudFront, etc.).

Confirm the app works on the default URL the host gives you (e.g. `your-project.vercel.app`) before adding the custom domain.

---

## 3. Add the custom domain in your host

- **Vercel:** Project → **Settings** → **Domains** → Add e.g. `app.airdroptennis.com`. Vercel will show you which DNS records to create.
- **Netlify:** **Domain settings** → Add custom domain → follow the DNS instructions.
- **Cloudflare Pages:** **Custom domains** → Add domain.

The host will usually offer **automatic HTTPS** once DNS is pointing to them.

---

## 4. Point DNS at your host

In your **domain registrar** (or DNS provider, e.g. Cloudflare):

- For a **subdomain** like `app.airdroptennis.com`:
  - Add a **CNAME** record:  
    **Name:** `app` (or `app.airdroptennis`)  
    **Value:** the host’s target (e.g. `cname.vercel-dns.com` for Vercel).
- Some hosts want an **A** record instead; they’ll give you an IP. Use what the host’s “Custom domain” instructions say.

Wait for DNS to propagate (minutes to a few hours). The host will then issue SSL and your app will load at `https://app.airdroptennis.com`.

---

## 5. Configure Supabase Auth for the custom domain

1. Open **Supabase Dashboard** → your project → **Authentication** → **URL Configuration**.
2. **Site URL:** set to `https://app.airdroptennis.com` (your real app URL).
3. **Redirect URLs:** add:
   - `https://app.airdroptennis.com`
   - `https://app.airdroptennis.com/**`

Save. This makes email confirmation and password reset links use your custom domain.

---

## 6. Configure Stripe (if you use Checkout)

If your **backend or Edge Function** creates Stripe Checkout sessions and sets `success_url` / `cancel_url`, set those to your custom domain, e.g.:

- Success: `https://app.airdroptennis.com/home?session_id={CHECKOUT_SESSION_ID}`
- Cancel: `https://app.airdroptennis.com/home`

If those URLs are built from the request (e.g. from the front-end), ensure the front-end is served from your custom domain so the origin is correct.

---

## 7. Optional: subdomain / academy logic

If you use **AcademyContext** or **middleware** and your app will live at a single hostname like `app.airdroptennis.com` (no per-academy subdomains), you can treat that host as the “main” app:

- In **AcademyContext.js**, in `getSubdomainFromHost()`, you can treat `app.airdroptennis.com` as a root host (no subdomain) so the app doesn’t try to resolve an academy from “app”.
- In **middleware.ts**, add your production host to `ROOT_HOSTS` if you use that middleware.

Only needed if you have subdomain-based routing and one main app URL.

---

## 8. Quick checklist

- [ ] Domain purchased and DNS managed (registrar or Cloudflare).
- [ ] Web app built (`npx expo export --platform web`) and deployed to Vercel/Netlify/etc.
- [ ] Custom domain added in the host and DNS (CNAME or A) pointing at the host.
- [ ] App loads at `https://your-custom-domain.com` with a padlock (HTTPS).
- [ ] Supabase **Site URL** and **Redirect URLs** set to your custom domain.
- [ ] Stripe **success_url** / **cancel_url** (if any) set to your custom domain.
- [ ] Login, signup, password reset, and payment return tested on the new URL.

For a concise “what can break” list, see **CUSTOM_DOMAIN_CHECKLIST.md**.
