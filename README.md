# PhoneHub

Premium multi-brand smartphone storefront for Kenya, migrated from the approved Lovable preview.

## Status
- **Frontend:** approved, interactive demo only; not ready to process real orders or payments.
- **Backend:** not yet implemented; cloud database provisioned but schema, authentication and security controls remain to be built.
- **Payment gateway:** not connected. Never input real card details into the demonstration.
- **Images:** illustrative SVG hero placeholder included. Replace with licensed product images before launch.

## Development

```bash
bun install
bun run dev
bun run build
bun run test
```

The current application uses TanStack Start, React, TypeScript, Tailwind and shadcn/ui components.

## Next steps
See [roadmap.md](roadmap.md) for the implementation plan. Use secure email authentication, database-enforced authorization, server-verified payments, and administrator role checks. Never store full card numbers or CVVs.
