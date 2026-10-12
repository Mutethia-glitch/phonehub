# PhoneHub backend — phase 1

## Current status (13 October 2026)

- **Existing frontend:** approved Lovable preview. No redesign or live payment behavior has been introduced.
- **GitHub branch:** `backend/phase-1-schema`.
- **Database:** Lovable-managed Supabase Postgres was provisioned, and migration `202610130001_phonehub_core.sql` was applied and inspected (7 RLS-protected tables). `202610130002_checkout_snapshot.sql` was also applied, adding a locked cart snapshot and reducing profile update privileges.
- **API:** `src/lib/phonehub/backend-api.ts` implements typed read and write methods over Supabase PostgREST with JWT-based RLS; `src/lib/phonehub/auth-api.ts` supports passwordless email OTP verification, refresh and logout. These API modules are **not yet wired to storefront components**, and the current UI remains demo-only.
- **Payments:** no live Stripe or Paystack keys, charges, or webhooks. Pending-order RPC does NOT process payments or mark orders paid.

## Connecting a GitHub deployment to Supabase

A GitHub repo is source control, **not** a running database or API server. To use the backend in a separately deployed app, obtain a network-reachable Supabase project URL and **public anon/publishable** API key from the owner. If the Lovable-managed database cannot be accessed independently, create a client-owned Supabase project and apply both migrations there in order. Do NOT copy a service-role key into the browser or commit any secret to GitHub.

Set the following in the hosting platform's environment settings:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

These are placeholders, not credentials. Ensure all store-client calls use short-lived verified customer access tokens. The public key does not bypass RLS. Never put a service role key, payment secret, JWT signing secret or payment webhook secret in a `VITE_` variable.

## Auth configuration

Enable email OTP sign-in in Supabase Auth. For six-digit OTP entry, modify the Auth email template to include the `{{ .Token }}` placeholder. Configure production Site URL and redirect allowlist. Do not store refresh tokens in logs or analytics. For a production browser app, use an official Supabase session implementation with secure persistence/refresh, preferably an HttpOnly cookie-backed SSR integration where supported. The helper functions intentionally DO NOT claim to manage full sessions.

## Admin onboarding

1. The owner signs up through the real Supabase Auth flow.
2. An authorized database operator obtains that user's exact UUID from `auth.users`.
3. Using the privileged Supabase SQL editor, grant access explicitly:

```sql
insert into public.staff_roles(user_id, role)
values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid, 'admin')
on conflict (user_id) do update set role = excluded.role;
```

Never create an admin automatically based on the first signup, a hardcoded email, or a client-supplied `role`. No customer is authorized to insert/update `staff_roles` through RLS. Before connecting the real admin dashboard, enforce both authenticated role validation and RLS on every sensitive data request. The current demo `/admin` route is not authenticated and contains only mock data, so **do not connect real data there until guarded**.

## Catalog, orders and card handling

Product inventory starts empty and unpublished. Create real products through authorized admin actions only after the owner supplies authentic photos/prices/stock. Prices are WHOLE Kenyan shillings (KES) as integers, not floats. Customer carts are owned by `auth.uid()`. The `phonehub_create_pending_order` RPC calculates totals using trusted server-side catalog prices and returns an **unpaid** order. Payment failure/success must be set only via signature-verified Stripe/Paystack webhooks in a future phase; never trust a redirect query parameter or browser-reported outcome. The administrator may see only non-sensitive card metadata including last four digits, not full PAN or CVV.

## Remaining work before public launch

1. Confirm independent Supabase URL/public key and apply both SQL migrations.
2. Connect approved storefront to real email OTP login and persistent cart without changing its visual design.
3. Protect the admin route with server-verified role checks and preserve existing admin visuals.
4. Build product-management and order-management screens against the RLS API; create initial real inventory.
5. Add payment provider only after verifying merchant account capabilities for a Kenyan business; verify webhooks and protect stock/order finalization against double processing.
6. Test user isolation, RLS admin restrictions, checkout concurrency, authentication, success/failure webhooks, and deployment.

**DO NOT launch the demo checkout as a real payment system.**
