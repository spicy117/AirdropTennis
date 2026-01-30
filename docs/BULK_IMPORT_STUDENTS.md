# Bulk import existing clients (students)

Use this to add existing clients from a spreadsheet (names, email, phone) and create accounts for them so they can log in. You can set or generate passwords and change them later.

## 1. Get your Supabase service role key

- In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **API**
- Copy **Project URL** and **service_role** (secret) key.
- **Never** commit the service role key or use it in the app; it bypasses Row Level Security. Use it only for this one-off script on your machine.

## 2. Prepare your CSV

Create a CSV file with these columns (order matters):

| Column        | Required | Description |
|---------------|----------|-------------|
| `email`       | Yes      | Login email (must be unique) |
| `student_name`| Yes      | Full name (e.g. "Jane Smith"; script splits into first/last) |
| `phone`       | No       | Phone number (for SMS/display) |
| `password`    | No       | Initial password; if empty, see below |

**Example** (see `scripts/students-import.example.csv`):

```csv
email,student_name,phone,password
jane@example.com,Jane Smith,+61412345678,ChangeMe123!
bob@example.com,Bob Jones,0412345679,
sue@example.com,Sue Wong,+61 400 111 222,
```

- First row can be a header row starting with `email`; it will be skipped.
- The script uses `student_name` as the display name and derives first/last name (first word = first name, rest = last name).
- If a row has no `password`, the script will:
  - Use a **single default password** for everyone if you set `BULK_IMPORT_DEFAULT_PASSWORD` in `.env` (e.g. `ChangeMe123!`), or
  - **Generate a random password** per user and write them to `imported-passwords.csv` in the same folder as your CSV (so you can send each person their password).

Avoid commas inside fields; if you need them, wrap the field in double quotes.

## 3. Configure environment

In your project root, create or edit `.env` (this file is gitignored; do not commit it):

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret_here
```

Optional:

```env
BULK_IMPORT_DEFAULT_PASSWORD=ChangeMe123!
```

If you set `BULK_IMPORT_DEFAULT_PASSWORD`, every imported user without a password column will get this password (e.g. one temporary password they all change on first login).

## 4. Install dotenv (if needed)

The script uses `dotenv` to load `.env`. If you get a "Cannot find module 'dotenv'" error:

```bash
npm install dotenv
```

(Expo already depends on it transitively; you may not need this.)

## 5. Run the script

From the project root:

```bash
node scripts/bulk-import-students.js path/to/your-file.csv
```

If you put your CSV at `scripts/students-import.csv`, you can run:

```bash
node scripts/bulk-import-students.js
```

The script will:

- Create a Supabase Auth user for each row with **email already confirmed** (no verification email).
- Set the password (from CSV, default, or generated).
- Create or update the **profile** (name from student_name, phone, role = student).

Duplicate emails are **skipped** (user already exists); the script will try to update their profile with the CSV name/phone. Results are printed: created count, skipped count, and any errors.

## 6. Passwords and changing them later

- **Same temporary password for everyone:** set `BULK_IMPORT_DEFAULT_PASSWORD` in `.env` and leave the password column empty. Tell clients to sign in and change password (e.g. Profile or “Forgot password”).
- **Per-row passwords:** put a password in the 5th column for each row. You can then send each client their login and password securely.
- **Generated passwords:** leave password empty and don’t set `BULK_IMPORT_DEFAULT_PASSWORD`. The script writes `email,password` to `imported-passwords.csv` next to your CSV. Send each person their password securely; they can change it after first login.

Users can change their password anytime via your app’s “Forgot password” flow or any profile/settings screen you add.

## Quick checklist

- [ ] CSV has columns: `email`, `student_name`, `phone`, (optional) `password`
- [ ] `.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Optional: `BULK_IMPORT_DEFAULT_PASSWORD` if you want one temp password for all
- [ ] Run: `node scripts/bulk-import-students.js your-file.csv`
- [ ] If passwords were generated, send `imported-passwords.csv` contents to users securely; remind them to change password on first login if using a shared temp one
