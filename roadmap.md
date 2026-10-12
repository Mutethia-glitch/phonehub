# PhoneHub implementation roadmap

## Approved storefront — frozen visual baseline
- [x] Premium multi-brand phone store preview (approved)
- [x] Original demo was approved; removal of demo data from development branch completed
- [x] Transfer code from Lovable to GitHub

## Backend phase 1 — in progress
- [ ] Provision separate CLIENT-OWNED Supabase database (old Lovable database remains unused)
- [x] SQL schema: profiles, staff roles, products, carts, orders, lines and payment metadata
- [x] RLS tested in previous Lovable database; reapply and verify in separate database
- [x] Payment status updates forbidden to ordinary users
- [x] Server-trusted pending-order creation function (does not charge cards)
- [x] Backend REST adapter and passwordless email Auth helpers committed
- [x] Add API-unit test cases and setup docs
- [x] Apply second checkout snapshot hardening migration
- [x] Prior backend lint/typecheck/tests/build passed; rerun CI for no-demo branch
- [ ] Confirm external Supabase project URL/public key to connect GitHub deployment
- [x] Email OTP flow wired to frontend; [ ] implement secure persisted session / refresh
- [x] Product, cart and order-history client screens use Supabase adapter when configured
- [x] Admin UI now checks authenticated role; DB RLS enforces data access (server-side route hardening still pending)
- [x] Basic admin product CRUD and order list API, requires external Supabase config

## Payment phase 2 — blocked pending client details
- [ ] Confirm Kenya-supported Stripe or Paystack merchant account and credentials
- [ ] Implement provider hosted/embedded checkout; no raw PAN/CVV handling
- [ ] Verify webhook signatures, event idempotency, inventory reservation and order finalization
- [ ] Customer-facing success/failure only on verified payment status
- [ ] Admin-only card metadata (masked last4), orders and transaction history

## Launch phase 3
- [x] Remove demo product prices/orders from development code; [ ] client to provide licensed images and actual inventory
- [ ] Confirm delivery methods/fees, return/refund terms, legal pages and domain
- [ ] End-to-end authentication, cart, authorization, payment and failure testing
- [ ] Configure environment secrets in hosting, monitoring, backups and deployment

**The live storefront continues to be a demonstration until the unchecked steps are completed.**

## No-demo cutover
- [x] Delete seeded fake products, card details, demo orders and simulated payments from Github branch
- [x] Clear old browser-local mock order records on load
- [x] Disable customer checkout until verified provider integration
- [ ] Connect new Supabase project; verify empty inventory and RLS with two real test accounts
- [ ] Merge reviewed branch and deploy to hosting
