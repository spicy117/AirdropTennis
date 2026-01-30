# Academy Multi-Tenancy

This folder contains schema and RLS for per-academy (subdomain) scoping.

## Migrations

1. **`migrations/001_academies_and_tenant_columns.sql`**  
   - Creates `academies` (id, name, subdomain_prefix UNIQUE, stripe_connect_id).  
   - Adds `academy_id` (FK to academies) to:  
     `profiles`, `locations`, `bookings`, `availabilities`, `booking_requests`, `courts`, `court_types`.

2. **`migrations/002_academy_rls.sql`**  
   - Defines `auth.user_academy_id()` from `profiles.academy_id` for the current user.  
   - Enables RLS on `academies` (public read for subdomain resolution).  
   - Enables RLS on all tenant tables and adds policies that restrict by `academy_id = auth.user_academy_id()`.

Run in order in the Supabase SQL Editor (or via Supabase CLI).

## Auto-Inclusion of `academy_id`

- **Context:** `contexts/AcademyContext.js`  
  Resolves subdomain (e.g. from `window.location.hostname`) → fetches `academies` by `subdomain_prefix` → exposes `academyId` and `academy` globally.

- **Scoped client:** `lib/supabaseAcademy.js`  
  `createAcademyScopedClient(academyId)` returns a client that:  
  - **INSERT:** adds `academy_id` to the payload for tenant tables.  
  - **SELECT / UPDATE / DELETE:** adds `.eq('academy_id', academyId)` for tenant tables.

**Usage in components:**

```js
import { useAcademy } from '../contexts/AcademyContext';
import { createAcademyScopedClient } from '../lib/supabaseAcademy';

function MyComponent() {
  const { academyId } = useAcademy();
  const scoped = useMemo(() => createAcademyScopedClient(academyId), [academyId]);

  // INSERT: academy_id is added automatically for tenant tables
  await scoped.from('bookings').insert({ user_id, location_id, start_time, ... });

  // SELECT: filtered by academy_id automatically
  const { data } = await scoped.from('bookings').select('*');
}
```

Migrate existing `supabase.from(...)` calls to use `scoped.from(...)` when the table is tenant-scoped and you want automatic `academy_id` handling.

## RLS Behavior

- **academies:** `SELECT` allowed for `anon` and `authenticated` so the app can resolve subdomain → academy before login.
- **profiles, locations, bookings, availabilities, booking_requests, courts, court_types:**  
  All policies use `auth.user_academy_id()`. Ensure each user’s row in `profiles` has `academy_id` set so they only see and change data for that academy.

## Next.js Middleware

`middleware.ts` at the project root is for a future Next.js app (e.g. `*.servestream.com`). It sets the `x-subdomain` header from the host so API routes or SSR can pass subdomain into the React app. The current Expo app derives subdomain in the client from `window.location.hostname` via `AcademyContext`.
