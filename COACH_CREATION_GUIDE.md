# Coach Creation Guide

## Current Setup

The app now uses a **database function** instead of an Edge Function for creating coaches. This works immediately without needing to deploy anything.

## How It Works

1. **If the user account already exists** in Supabase Auth:
   - The function automatically creates/updates their profile with the 'coach' role
   - ✅ Works immediately!

2. **If the user account doesn't exist**:
   - The function will show you instructions
   - You need to create the user account first via one of these methods:

## Creating User Accounts for New Coaches

### Option 1: Supabase Dashboard - Add User (Recommended - No Email Issues)

**Important:** Use "Add User" NOT "Invite User" to avoid email link expiration issues.

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/qdlzumzkhbnxpkprbuju/auth/users
2. Click **"Add User"** button (top right)
3. Enter the coach's email address
4. **Set a temporary password** (you'll share this with the coach)
5. **Uncheck "Auto Confirm User"** if you want them to verify their email later
6. Click **"Create User"**
7. **Copy the temporary password** and share it securely with the coach
8. Go back to the Admin Coaches page in your app
9. Try creating the coach again - it will now work!

### Option 2: Let Coach Sign Up Themselves

1. Tell the coach to go to your app's signup page
2. Have them sign up with their email
3. Once they've signed up, go to Admin Coaches page
4. Create the coach profile - it will automatically link to their account

### ⚠️ Avoid: Email Invite System

The "Invite User" feature uses email links that can expire. Use "Add User" instead for more reliable coach creation.

### Option 3: Manual SQL (Advanced)

If you need to create users programmatically, you can use the Supabase Admin API or create a trigger, but the dashboard method is simplest.

## Database Function

The function `create_coach_profile` is located in:
- `supabase/create_coach_simple.sql`

Run this SQL in your Supabase SQL Editor if you haven't already.

## Future: Full Automation

If you want fully automated coach creation (including user account creation), you'll need to:
1. Deploy the Edge Function (`supabase/functions/create-coach/index.ts`)
2. Set the `SUPABASE_SERVICE_ROLE_KEY` environment variable
3. See `DEPLOYMENT_INSTRUCTIONS.md` for details

For now, the database function approach works great and is simpler to maintain!
