<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Frontend demo architecture
- PhoneHub uses a root DemoProvider for session-only customer/cart state and versioned localStorage for mock orders, so storefront and admin share simulations without a backend.
- Keep public shop sections on the index page and the admin preview on /admin; neither route provides real authentication or payment processing.
- Device illustrations use shared PhoneArt and centralized CSS tokens, with a bundled generated studio image for the flagship campaign.