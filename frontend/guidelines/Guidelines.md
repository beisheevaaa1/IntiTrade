# IntiTrade — Frontend Guidelines

Rules for working on the IntiTrade frontend (React + Vite + TypeScript +
Tailwind CSS v4 + Radix UI). Keep changes consistent with these conventions.

## General

- Language is **TypeScript**. Type props and API responses; avoid `any`.
- Prefer responsive layouts with **flexbox and grid**. Use absolute positioning
  only when necessary.
- Keep files small. Put reusable components, hooks, and helpers in their own
  files under the correct folder (see structure below).
- Refactor as you go; don't leave dead code or commented-out blocks.
- Run `npm run typecheck` and `npm run build` before considering work done.

## Project structure

```
src/api/        Centralized API layer (axios client, config, response types)
src/app/        App shell, routes, pages, and components
  app/pages/       One file per screen (Home, BrowseListings, Inbox, ...)
  app/components/  Shared components; components/ui = Radix design system
src/state/      React context providers (AuthContext, ToastContext)
src/lib/        Cross-cutting helpers (telemetry, utils)
src/utils/      Formatting, error helpers, markdown rendering
src/styles/     Tailwind and theme CSS
src/types.ts    Shared TypeScript types
```

New screens go in `src/app/pages/` and are registered in
`src/app/routes.tsx`. Shared UI goes in `src/app/components/`.

## Calling the API

- **Always** use the shared axios instance from `src/api/client.ts`
  (`import { api } from "../api/client"`). Never call `axios` or `fetch`
  directly — the shared client sets `baseURL`, `withCredentials: true`, and the
  error/telemetry interceptor.
- For image/upload URLs use the `mediaUrl()` helper from `client.ts`; don't
  hand-build server URLs.
- API response shapes live in `src/api/responses.ts`. Reuse those types instead
  of redefining them.
- Do not hardcode the API origin. `src/api/config.ts` handles it: production
  uses the page origin (first-party cookies); development uses `VITE_API_URL`
  or `http://localhost:4000`.

## Authentication (important)

- Auth state comes from `src/state/AuthContext.tsx`. Read the user from that
  context; don't fetch `/auth/me` ad hoc in components.
- The session is a server-set **HttpOnly cookie**. **Never** store the JWT or
  any auth token in `localStorage` or `sessionStorage` — this is a security
  rule, not a preference. The cookie travels automatically because the client
  uses `withCredentials`.
- Gate protected pages on the auth context's user/loading state.

## UI and design system

- Build on the existing Radix-based components in `src/app/components/ui`
  before introducing a new library or custom widget.
- Style with **Tailwind utility classes** and the theme tokens in
  `src/styles/theme.css`. Don't add inline color hex values that bypass the
  theme.
- Icons come from `lucide-react`. Toasts go through `ToastContext`
  (built on `sonner`) — don't create separate notification systems.
- Keep labels action-oriented and text in **English** (the app is
  English-facing).

## Do / Don't

- Do keep components presentational where possible and push data logic to the
  API layer or context.
- Do handle loading and error states for every network call.
- Don't commit `.env` files or secrets.
- Don't introduce new heavy dependencies without a clear need — the initial
  JS bundle size is checked in CI.
