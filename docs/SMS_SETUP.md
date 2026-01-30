# SMS Notifications Setup (Admin: New Booking Alert)

This app can send an SMS to the admin when a student makes a booking. It uses **Twilio** for sending and **Supabase Edge Functions + Database Webhooks** to trigger on every new row in `bookings`.

## Overview

1. **Twilio** – You send SMS through Twilio’s API (account, phone number, credentials).
2. **Supabase Edge Function** – `send-booking-sms` receives the webhook, looks up student/location, and calls Twilio.
3. **Supabase Database Webhook** – Fires on `bookings` INSERT and POSTs the new row to the Edge Function.

No app code changes are required; any insert into `bookings` (student app, admin assign lesson, etc.) will trigger the SMS.

---

## Step 1: Twilio

1. Sign up at [twilio.com](https://www.twilio.com).
2. In the Console:
   - **Account SID** and **Auth Token** (Account Info).
   - **Phone Numbers → Manage → Buy a number** (or use a trial number). Pick one that can send SMS (e.g. to your country). Note the number in E.164, e.g. `+61xxxxxxxxx`.
3. (Trial accounts) Add your admin mobile as a “Verified Caller ID” so Twilio can send to it.

---

## Step 2: Supabase Secrets (Edge Function)

The Edge Function needs these at runtime. Set them in Supabase:

**Dashboard:** Project → **Edge Functions** → **Secrets** (or **Settings → Edge Functions → Secrets**).

| Secret name              | Description                          | Example        |
|--------------------------|--------------------------------------|----------------|
| `ADMIN_PHONE`            | Admin mobile (receive SMS), E.164    | `+61412345678` |
| `TWILIO_ACCOUNT_SID`      | Twilio Account SID                   | `AC...`        |
| `TWILIO_AUTH_TOKEN`       | Twilio Auth Token                    | (from Console) |
| `TWILIO_PHONE`            | Twilio “From” number, E.164          | `+61xxxxxxxxx` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are usually set by Supabase; the function uses them to read `profiles` and `locations`.

---

## Step 3: Deploy the Edge Function

From the project root (where `supabase/` lives):

```bash
# Install Supabase CLI if needed: npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # from Supabase project URL
supabase functions deploy send-booking-sms --no-verify-jwt
```

Use `--no-verify-jwt` so the Database Webhook (server-to-server) can call the function without a user JWT.

After deploy, note the function URL, e.g.:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-booking-sms`

---

## Step 4: Database Webhook (Trigger on New Booking)

1. In Supabase: **Database** → **Webhooks** (or **Database** → **Replication** / **Webhooks** depending on UI).
2. **Create a new webhook** (or “Add webhook”).
3. Set:
   - **Name:** e.g. `On booking insert – send SMS`
   - **Table:** `bookings`
   - **Events:** **Insert** only (or Include INSERT).
   - **Type:** HTTP / Webhook.
   - **URL:**  
     `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-booking-sms`
   - **HTTP method:** POST.
   - **Headers (if required):**  
     `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`  
     (only if your project requires it for Edge Function calls; many setups use the webhook’s internal auth.)

Supabase will send a JSON body like:

```json
{
  "type": "INSERT",
  "table": "bookings",
  "schema": "public",
  "record": { "id": "...", "user_id": "...", "location_id": "...", "start_time": "...", ... },
  "old_record": null
}
```

The Edge Function uses `record` to fetch student and location and then sends the SMS.

---

## Step 5: Test

1. Create a booking (e.g. as a student in the app, or via Admin “Assign lesson”).
2. Check that the admin phone receives an SMS like:  
   **New booking: [Student Name] at [Location] on [Date/Time] ([Service])**
3. In Supabase: **Edge Functions** → **send-booking-sms** → **Logs** to see requests and any errors.

---

## Troubleshooting

- **No SMS:** Check Edge Function logs for 4xx/5xx or Twilio errors. Confirm `ADMIN_PHONE`, `TWILIO_PHONE`, and Twilio credentials in Edge Function secrets.
- **Twilio 21211 / invalid “To”:** Use E.164 for `ADMIN_PHONE` (e.g. `+61412345678`).
- **Webhook not firing:** Confirm webhook is on table `bookings`, event **Insert**, and URL is the exact Edge Function URL.
- **401 from Edge Function:** If your webhook sends a Bearer token, ensure it matches the key the function expects, or deploy with `--no-verify-jwt` and rely on Supabase’s webhook auth.

---

---

## Coach + Student SMS (Booking Assigned to Coach)

When a booking is **assigned to a coach** (either on insert with `coach_id` or when `coach_id` is set/updated), the app can send:

- **Coach:** an SMS with booking details (“You've been assigned: …”).
- **Student:** an SMS saying **“Booking confirmed.”**

### Coach + Student function and webhook

1. **Deploy the Edge Function** (uses same Twilio secrets as admin SMS):

   ```bash
   supabase functions deploy send-coach-booking-sms --no-verify-jwt
   ```

   URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-coach-booking-sms`

2. **Create a Database Webhook**:
   - **Table:** `bookings`
   - **Events:** **Insert** and **Update** (so both “new booking with coach” and “coach assigned later” are covered).
   - **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-coach-booking-sms`
   - **HTTP method:** POST.

3. **Phone numbers in `profiles`** (E.164, e.g. `+61412345678`):
   - **Coach:** `profiles.phone` for `profiles.id = booking.coach_id`. If missing, coach SMS is skipped.
   - **Student:** `profiles.phone` for `profiles.id = booking.user_id`. If missing, student SMS is skipped (coach still receives their SMS).

**Messages:**
- **Coach:** *"You've been assigned: [Student Name] at [Location] on [Date/Time] ([Service])."* then *"To view your upcoming bookings: app.airdroptennis.com"*
- **Student:** *Booking confirmed with date, location, and "To view your upcoming bookings: app.airdroptennis.com" then "See you on the court!"*

---

## Rain Check SMS (Students)

When a coach submits a **rain check** (cancels selected bookings and refunds students), the app calls an Edge Function to send one SMS per affected student. No database webhook is used; the app invokes the function after a successful rain check.

### Deploy the rain check function

Uses the same Twilio secrets as above (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`).

```bash
supabase functions deploy send-rain-check-sms --no-verify-jwt
```

**Message (per student):**  
*"Due to rain, your upcoming tennis lesson at [Location], [Date/Time] has been cancelled. You have been refunded for this session.*  
*Please re-book your lesson: app.airdroptennis.com*  
*We apologise for any inconvenience."*

Students need `profiles.phone` (E.164) set to receive the SMS.

**Troubleshooting rain check SMS**

- **No SMS received:** Check Supabase → Edge Functions → `send-rain-check-sms` → Logs. You should see e.g. `send-rain-check-sms called with N items` and `profiles with phone: M of N`. If `M` is 0, add `profiles.phone` (E.164, e.g. `+61412345678`) for the affected students.
- **401 / Unauthorized when coach submits rain check:** Deploy the function with `--no-verify-jwt` so the app can call it with the coach’s session:  
  `supabase functions deploy send-rain-check-sms --no-verify-jwt`
- **Twilio errors in logs:** Same as other SMS: check Twilio secrets and E.164 phone format.

---

## Rain Check History (Supabase table)

When a coach submits a rain check, the app **snapshots** each cancelled booking into `rain_check_history` before deleting it from `bookings`. That way you keep location, time, student, and service for reporting or history.

- **Table:** `rain_check_history` (see `supabase/migrations/003_rain_check_history.sql`).
- **Columns:** `original_booking_id`, `user_id`, `coach_id`, `location_id`, `location_name`, `start_time`, `end_time`, `service_name`, `credit_cost`, `cancelled_at`, `reason` (e.g. `rain_check`), `academy_id`.
- **Apply migration:** In Supabase SQL Editor, run the contents of `003_rain_check_history.sql`, or use `supabase db push` / `supabase migration up` if you use the CLI.

You can query `rain_check_history` in the dashboard or build a “Rain check history” screen that lists past rain checks by coach or student.

---

## Extending (Optional)

- **Multiple admins:** Store admin phone numbers in a table (e.g. `profiles` where `role = 'admin'`) and in the Edge Function query all admin phones and send to each.
- **Other events:** Add more webhooks (e.g. on `booking_requests` INSERT) and new Edge Functions, or the same function with different payload handling, to send SMS for cancellations, rain checks, etc.
