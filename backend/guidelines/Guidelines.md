# IntiTrade — Backend Guidelines

Rules for working on the IntiTrade backend (Node.js + Express + TypeScript +
Prisma + PostgreSQL + Socket.IO). Follow the existing patterns.

## General

- Language is **TypeScript, ESM**. Local imports must include the `.js`
  extension (e.g. `import { prisma } from "../prisma.js"`).
- One responsibility per file: HTTP routes in `src/routes/`, reusable logic in
  `src/utils/` and `src/services/`, middleware in `src/middleware/`.
- Reuse the single Prisma client from `src/prisma.ts`. Never construct a new
  `PrismaClient` elsewhere.
- Before finishing: `npm run build` and `npm test` must pass.

## Validation (required)

- **Validate every request body with Zod before touching the database.** Define
  a schema per route (see `routes/auth.ts`) and return HTTP 400 with
  `error.flatten()` on failure.
- Reuse the helpers in `src/utils/validation.ts` for phones, emails, and the
  bcrypt password-length limit rather than re-implementing them.

## Authentication & security

- Passwords are hashed with **bcrypt at cost 12**. Never store or log a raw
  password. Compare with `bcrypt.compare`.
- **Never return sensitive fields.** Pass user objects through `sanitizeUser()`
  (`utils/auth.ts`) so `passwordHash` and `tokenVersion` are stripped from
  responses.
- Protect routes with the middleware in `middleware/auth.ts`: `requireAuth`,
  `optionalAuth`, `requireAdmin`. Don't re-verify tokens by hand in routes.
- JWTs live in the **HttpOnly `intitrade_session` cookie** (see
  `utils/sessionCookie.ts`). Keep `HttpOnly`, `SameSite=Lax`, and `Secure` in
  production. To force logout, increment `tokenVersion`.
- Rate-limit sensitive endpoints (auth, verification) with
  `middleware/rateLimit.ts`, following the patterns at the top of
  `routes/auth.ts`.
- Keep the security headers and strict CORS allow-list configured in
  `src/app.ts`. Don't loosen them.

## Database & Prisma

- Use `prisma.$transaction` whenever two or more writes must succeed together
  (e.g. creating a user + verification token).
- Store money as `Decimal @db.Decimal(10, 2)` — never `Float` — for prices and
  amounts.
- Handle unique-constraint conflicts by catching
  `Prisma.PrismaClientKnownRequestError` with code `P2002` and returning
  HTTP 409.
- Add an `@@index` for columns you filter or sort on frequently.

## Migrations (deployment-critical)

- Every schema change needs a Prisma migration (`npx prisma migrate dev`).
  Never edit the database by hand.
- **When you add a migration, update `deploy/backend-schema-compatibility`** to
  the new migration name. CI enforces this, and deployment rollback safety
  depends on it. Never assign a marker manually to an old release.

## Business rules to preserve

- New listings default to `status: PENDING`. They must **not** appear publicly
  until an admin approves them (mandatory moderation).
- Real-time messages (`src/socket.ts`) are authenticated with the same JWT,
  validated with Zod, and rate-limited per user before being saved.

## Testing

- Tests use **vitest** and are colocated next to the code as `*.test.ts`.
- Add or update a test when you change auth, validation, moderation, uploads,
  or any security-relevant logic.

## Never

- Never commit `.env`, secrets, SSH keys, or database dumps.
- Never expose `passwordHash`, tokens, or draft/rejected content to
  non-owners/non-admins.
