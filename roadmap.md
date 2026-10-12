# PhoneHub implementation roadmap

## Approved storefront — frozen visual baseline
- [x] Premium multi-brand phone store preview (approved)
- [x] Demo shopping cart, checkout simulation and admin UI
- [x] Transfer code from Lovable to GitHub

## Backend phase 1 — in progress
- [x] Supabase database provisioned
- [x] SQL schema: profiles, staff roles, products, carts, orders, lines and payment metadata
- [x] Row-level security policies verified for all seven tables
- [x] Payment status updates forbidden to ordinary users
- [x] Server-trusted pending-order creation function (does not charge cards)
- [x] Backend REST adapter and passwordless email Auth helpers committed
- [x] Add API-unit test cases and setup docs
- [ ] Apply second checkout snapshot hardening migration and verify
- [ ] Execute full tests/build (no live build runner configured yet)
- [ ] Confirm external Supabase project URL/public key to connect GitHub deployment
- [ ] Implement complete persistent customer session handling and wire email OTP to frontend
- [ ] Connect real catalog/cart/order screens with approved frontend visuals unchanged
- [ ] Protect /admin with server-enforced authenticated role, before exposing real data
- [ ] Admin product create/edit/stock and verified order management

## Payment phase 2 — blocked pending client details
- [ ] Confirm Kenya-supported Stripe or Paystack merchant account and credentials
- [ ] Implement provider hosted/embedded checkout; no raw PAN/CVV handling
- [ ] Verify webhook signatures, event idempotency, inventory reservation and order finalization
- [ ] Customer-facing success/failure only on verified payment status
- [ ] Admin-only card metadata (masked last4), orders and transaction history

## Launch phase 3
- [ ] Replace demo images, prices and availability with actual client inventory
- [ ] Confirm delivery methods/fees, return/refund terms, legal pages and domain
- [ ] End-to-end authentication, cart, authorization, payment and failure testing
- [ ] Configure environment secrets in hosting, monitoring, backups and deployment

**The live storefront continues to be a demonstration until the unchecked steps are completed.**
