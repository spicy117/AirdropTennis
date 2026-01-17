# Deploying the Create Coach Edge Function

## Prerequisites

1. **Update Command Line Tools** (if needed):
   ```bash
   sudo rm -rf /Library/Developer/CommandLineTools
   sudo xcode-select --install
   ```
   Or update via System Settings → Software Update

2. **Install Supabase CLI**:
   ```bash
   brew install supabase/tap/supabase
   ```

3. **Login to Supabase**:
   ```bash
   supabase login
   ```

4. **Link your project**:
   ```bash
   cd /Users/jasper/Desktop/HelloWorldApp
   supabase link --project-ref qdlzumzkhbnxpkprbuju
   ```

## Deploy the Function

```bash
supabase functions deploy create-coach
```

## Set Environment Variables

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions**
4. Add the following environment variable:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Your service role key (found in Project Settings → API → service_role key)

⚠️ **Important**: Never expose the service role key in client-side code!

## Alternative: Manual Deployment via Dashboard

If you prefer not to use the CLI, you can:

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it `create-coach`
4. Copy the contents of `supabase/functions/create-coach/index.ts`
5. Paste into the function editor
6. Set the environment variable as described above
7. Deploy

## Verify Deployment

After deployment, test the function by creating a coach from the Admin Coaches page. The function should:
- Verify admin status
- Create the user account
- Create the profile with coach role
- Return a temporary password

## Troubleshooting

- **"Unauthorized" error**: Make sure you're logged in as an admin
- **"Function not found"**: Verify the function name matches exactly: `create-coach`
- **"Service role key missing"**: Ensure the environment variable is set in the dashboard
- **"User already exists"**: The email is already registered in your Supabase Auth
