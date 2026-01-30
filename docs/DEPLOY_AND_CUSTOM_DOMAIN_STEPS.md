# Step-by-step: Deploy app + custom domain (with ongoing edits)

This guide gets your app live at **app.airdroptennis.com** and lets you keep editing in Cursor and have changes go live when you push.

---

## Part A: Get your app on the internet (one-time)

### Step 1: Put your code on GitHub (if it isn’t already)

1. Create a repo at [github.com](https://github.com) (e.g. `airdroptennis-app`).
2. In Cursor, open the terminal (bottom panel) and run from your project folder:

   ```bash
   git remote -v
   ```

   If you already see `origin` pointing to GitHub, skip to Step 2.

3. If not, add GitHub as the remote (replace with your repo URL):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/airdroptennis-app.git
   ```

4. Push your code:

   ```bash
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

   (Use `master` instead of `main` if that’s your default branch.)

---

### Step 2: Deploy with Vercel (free, auto-deploys on push)

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
2. Click **Add New…** → **Project**.
3. **Import** the GitHub repo you just pushed (e.g. `airdroptennis-app`).
4. **Configure Project:**
   - **Framework Preset:** leave as “Other” or pick “Expo” if listed.
   - **Build Command:**  
     `npx expo export --platform web`  
     (Expo 54 uses Metro; `expo export:web` is deprecated and will fail.)
   - **Output Directory:**  
     `dist`
   - **Install Command:**  
     `npm install`
5. **Environment variables:**  
   Add any your app needs (e.g. `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`). You can add more later.
6. Click **Deploy**.
7. Wait for the build. When it’s done you’ll get a URL like `your-project.vercel.app`. Open it and confirm the app loads.  
   **This is your app’s live URL** until you add the custom domain.

---

### Step 3: Add your custom domain in Vercel

1. In Vercel: open your project → **Settings** → **Domains**.
2. Under “Domain”, type:  
   `app.airdroptennis.com`  
   and add it.
3. Vercel will show something like:
   - **Add a CNAME record**
   - **Name/Host:** `app` (or `app.airdroptennis`)
   - **Value/Points to:** `cname.vercel-dns.com`  
   Leave this tab open; you’ll use it in the next step.

---

### Step 4: Point DNS for app.airdroptennis.com to Vercel

You must add a **CNAME** for the **app** subdomain **only**. The rest of your domain (e.g. main Squarespace site) stays as it is.

1. Log in where **airdroptennis.com** DNS is managed (Squarespace Domains, Cloudflare, Namecheap, etc.).
2. Open **DNS settings** for **airdroptennis.com**.
3. **Add a new record:**
   - **Type:** CNAME  
   - **Name / Host:** `app` (so the full name is `app.airdroptennis.com`)  
   - **Value / Target / Points to:** exactly what Vercel showed (e.g. `cname.vercel-dns.com`)  
   - **TTL:** default (e.g. 3600) is fine.
4. Save.
5. Wait 5–60 minutes for DNS to propagate. In Vercel → Domains, the domain will show as “Valid” when it’s working.
6. Visit **https://app.airdroptennis.com** — you should see your app, not Squarespace.

**Important:**  
- Do **not** point the **root** domain (`airdroptennis.com`) or `www` to Vercel unless you want to replace Squarespace there.  
- Only the **app** subdomain should point to Vercel.

---

### Step 5: Tell Supabase to use your custom domain

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Set:
   - **Site URL:**  
     `https://app.airdroptennis.com`
   - **Redirect URLs:** add these two lines:
     - `https://app.airdroptennis.com`
     - `https://app.airdroptennis.com/**`
4. Save.

After this, email confirmation and password reset will redirect users to your app at app.airdroptennis.com.

---

### Step 6: Stripe (if you take payments)

1. Where you create Stripe Checkout (backend or Edge Function), set:
   - **Success URL:**  
     `https://app.airdroptennis.com/home?session_id={CHECKOUT_SESSION_ID}`  
     (or the path your app actually uses after payment.)
   - **Cancel URL:**  
     `https://app.airdroptennis.com/home`
2. If those URLs are built from the request (e.g. from the front-end), make sure the app is opened from **https://app.airdroptennis.com** when testing so the origin is correct.

---

## Part B: Making edits later (with people using the app)

Your setup is: **Cursor (edit)** → **Git (push)** → **Vercel (auto-deploy)**. Users always see the latest deploy.

### How to update the app

1. **Edit in Cursor** as usual (screens, components, Supabase, etc.).
2. **Test locally** if you want:
   ```bash
   npx expo start --web
   ```
   Open http://localhost:8081 and check.
3. **Commit and push:**
   ```bash
   git add .
   git commit -m "Short description of the change"
   git push
   ```
4. **Vercel** will detect the push, run `npx expo export --platform web`, and deploy. In a few minutes, **https://app.airdroptennis.com** will show the new version. Users don’t need to do anything; a refresh will load the update.

### Tips

- **Environment variables:** If you add or change env vars (e.g. new Stripe key), set them in Vercel: Project → **Settings** → **Environment Variables**, then trigger a redeploy (Deployments → … on latest → Redeploy).
- **Supabase / Stripe:** Code changes in Cursor are enough; config (redirect URLs, etc.) stays in Supabase Dashboard and Stripe Dashboard.
- **Breaking changes:** Avoid changing auth or payment flow in a way that breaks mid-session. Prefer additive changes and test locally or on a staging URL if you have one.

---

## Checklist (quick reference)

- [ ] Code on GitHub.
- [ ] Vercel project connected to that repo; build = `npx expo export --platform web`, output = `dist`.
- [ ] First deploy works at `your-project.vercel.app`.
- [ ] Domain `app.airdroptennis.com` added in Vercel → Domains.
- [ ] CNAME for `app` → `cname.vercel-dns.com` (or value Vercel shows) in your DNS.
- [ ] https://app.airdroptennis.com loads the app (not Squarespace).
- [ ] Supabase Site URL + Redirect URLs set to `https://app.airdroptennis.com` and `https://app.airdroptennis.com/**`.
- [ ] Stripe success/cancel URLs set to your app URL if you use Checkout.
- [ ] Later: edit in Cursor → commit → push → Vercel auto-deploys for users.
