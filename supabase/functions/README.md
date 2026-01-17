# Supabase Edge Functions

This directory contains Supabase Edge Functions for the application.

## Deploying Edge Functions

To deploy the Edge Functions, you'll need the Supabase CLI installed:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy create-coach
```

## Environment Variables

The Edge Functions require the following environment variables to be set in your Supabase project:

- `SUPABASE_URL` - Your Supabase project URL (automatically available)
- `SUPABASE_ANON_KEY` - Your Supabase anon key (automatically available)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (must be set manually)

### Setting Environment Variables

1. Go to your Supabase Dashboard
2. Navigate to Project Settings → Edge Functions
3. Add the `SUPABASE_SERVICE_ROLE_KEY` environment variable with your service role key

**⚠️ Important:** Never expose the service role key in client-side code. It should only be used in Edge Functions or other server-side code.

## create-coach Function

This function creates a new coach account with the following steps:

1. Verifies the requester is an admin
2. Creates a new user account in Supabase Auth
3. Creates a profile record with role 'coach'
4. Returns a temporary password (in production, this should be sent via email)

### Usage

```javascript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/create-coach`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: 'coach@example.com',
      fullName: 'John Doe',
    }),
  }
);
```

### Response

```json
{
  "success": true,
  "message": "Coach created successfully",
  "user": {
    "id": "uuid",
    "email": "coach@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "tempPassword": "temporary-password"
}
```
