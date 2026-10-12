# PhoneHub staging and deployment checklist

> Status: implementation preparation only. **Client-owned Supabase is not connected**, and payments are disabled. Do not launch live sales.

## 1. Client account ownership
- Client creates a dedicated Supabase organization/project (suggested name: `phonehub-production`).
- Client invites the developer with the minimum required organization/project role. Never share owner passwords, session cookies, personal OTPs, service-role JWTs or DB connection strings in chat/GitHub.
- Do not copy the older Lovable-managed database or any mock users, mock products, fake cards, or transactions. Fresh production tables start **empty**.
- Turn on billing alerts and secure backups; configure separate staging/prod projects before accepting real customer data.

## 2. Run migrations in the new project
Apply these files **in order** using Supabase's SQL Editor or migration CLI:

1. `supabase/migrations/202610130001_phonehub_core.sql`: seven RLS-protected data tables and pending-order function.
2. `supabase/migrations/202610130002_checkout_snapshot.sql`: locked cart-price snapshot and constrained profile edits.
3. `supabase/migrations/202610130003_delivery_and_media.sql`: delivery zones, shipping calculations, public image bucket with admin-only writes.

Run against a disposable staging database first. Check the expected eight public tables, security policies, and bucket `phonehub-product-images`. Do not apply against the old Lovable project. **No products or shipping zones are seeded.**

## 3. Connect app to Supabase
Set deployment environment variables (public, *not* service role secrets):

- `VITE_SUPABASE_URL`: new project's public API URL.
- `VITE_SUPABASE_ANON_KEY`: matching **publishable/anon** API key.

Never commit `.env`; it is ignored. Never put admin/service-role secrets, payment gateway keys, database connection strings, or webhooks into client-exposed `VITE_` variables. A different Supabase project requires both values to be updated together.

## 4. Admin + images
- Create the administrator as a real verified Supabase Auth account, then grant the exact `auth.users.id` explicitly in `staff_roles` via the privileged SQL editor; don't auto-promote a signup or hardcode an email.
- Test normal signed-in users cannot read unpublished products, staff roles, other users' carts, or other orders, and cannot upload images or create delivery zones.
- On the admin Products screen, upload a licensed JPG/PNG/WebP (max 5 MiB). The file is stored in `phonehub-product-images` with a unique key; the image URL is saved only when the product is saved.
- Add authentic phones, verified KSh prices, stock quantities, and delivery zones. New zones are disabled by default. Publish only when ready.
- Test a customer's published product image loads without exposing private admin details. Delete unused images using authorized storage tooling after replacing products; old image objects are not automatically removed.

## 5. Customer auth + checkout
- In Auth templates, use `{{ .Token }}` for email OTP. Configure sender, SMTP quotas, correct site URL and allowed redirect URLs.
- Complete secure session refresh/persistence and test expiry/logout before production. Current sessions are held only in memory.
- Checkout remains unavailable until payment is implemented, including signature-verified webhooks and transaction idempotency. Never display a successful payment based solely on a client response.

## 6. CI and hosting
- `bun install --frozen-lockfile`
- `bunx eslint src/lib/phonehub src/test/phonehub-backend.test.ts src/test/phonehub-media.test.ts --rule 'prettier/prettier:off'` (legacy Lovable frontend formatting is tracked separately)
- `bunx tsc --noEmit`
- `bun run test`
- `bun run build`

Choose and confirm a host that supports the TanStack Start/Nitro adapter used in `vite.config.ts`. Verify the deployed SSR entry point, secrets/environment values, TLS certificate, domain, backups, logs, and error reporting. GitHub is source control, not a server or database. Configure CI/CD only after the hosting environment is known.

## 7. Launch gate
Do not open checkout or publish sales until the client verifies inventory, fulfillment zones, taxes, returns/warranties, privacy policy, domain and support contacts; payment account eligibility; security tests (including checkout races and replayed webhooks); and proper admin identity/session handling.
