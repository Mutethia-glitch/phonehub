# PhoneHub

Multi-brand phone store with the approved Samsung-inspired layout. Customer-facing demo inventory, mock accounts, fake orders, fake Stripe results, and simulated checkout have been removed from the **GitHub development branch**.

## Status
- **Catalog:** reads published products from a client-owned Supabase project when configured. New database starts empty.
- **Authentication:** real Supabase email OTP API, with short-lived session held in memory for now; secure persisted sessions still pending.
- **Cart:** authenticated customer cart stored in Supabase with database RLS.
- **Admin:** real role-checked access; no public mock dashboard, orders or fake card information.
- **Payments:** DISABLED pending a verified merchant account, webhooks and end-to-end testing. No real orders or card transactions are created by the storefront.
- **Images:** temporary hero SVG can be replaced with licensed photographs.

## Local setup

```bash
bun install
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY using your separate Supabase project
bun run dev
bunx tsc --noEmit
bun run test
bun run build
```

Use a client-owned Supabase project, apply the ordered SQL files in [supabase/migrations](supabase/migrations), and follow [the setup guide](docs/BACKEND_SETUP.md).

The original Lovable preview remains separate and unchanged. This branch contains the no-demo replacement and requires review before merging. Never publish real card numbers, CVVs or private API keys.
