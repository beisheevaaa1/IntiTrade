# IntiTrade Backend API

> Node.js + Express + TypeScript + Prisma + PostgreSQL + Socket.io

## Быстрый старт

```bash
npm install
cp .env.example .env
# Настрой DATABASE_URL в .env на свою PostgreSQL
npx prisma generate
npx prisma migrate dev
npm run seed      # Загрузить демо-данные
npm run dev       # http://localhost:4000
```

## API Docs: `http://localhost:4000/api/docs`

## Production integration smoke test

The compiled backend includes a destructive, guarded smoke test for the
canonical production API. It creates uniquely marked temporary users and
content, promotes only its own temporary administrator, and verifies relational
and filesystem cleanup in a `finally` block. Before its first public write it
creates a local probe account, signs a short-lived token locally, and verifies
that the public `/api/auth/me` response returns that exact database row. It also
uses a same-host lock, request deadlines, and a 15-minute overall deadline.

Run it through a detached transient systemd service so an SSH disconnect cannot
terminate cleanup. From the active runtime directory:

```bash
cd /var/www/university-marketplace/backend/runtime-current
unit="intitrade-production-smoke-$(date -u +%Y%m%dT%H%M%SZ)"
systemd-run \
  --unit="$unit" \
  --collect \
  --wait \
  --working-directory=/var/www/university-marketplace/backend/runtime-current \
  --setenv=PRODUCTION_SMOKE_CONFIRM=RUN_INTITRADE_PRODUCTION_TEMP_DATA_SMOKE \
  --setenv=PRODUCTION_SMOKE_BASE_URL=https://intitrade.shop \
  --setenv=PRODUCTION_SMOKE_EXPECTED_VERSION="$(cat .app-version)" \
  --setenv=PRODUCTION_SMOKE_UPLOADS_DIR=/var/www/university-marketplace/backend/uploads \
  "$(command -v npm)" run smoke:production

# The unit continues if SSH disconnects; inspect it again with:
journalctl -u "$unit" --no-pager
```

Run it manually after a successful deployment, never as a frequent scheduled
job. It requires `NODE_ENV=production`, the matching deployed app version, email
verification disabled or configured for on-screen demo codes, and a local PostgreSQL
`DATABASE_URL`. It does not use or log any existing administrator credential. `SIGINT`, `SIGTERM`, and `SIGHUP`
abort the active request but allow cleanup to continue with fresh bounded
cleanup requests.

The support-ticket route briefly creates a smoke-labelled notification for each
active real administrator; the script removes only the exact notification
payload for its temporary ticket. Run during a quiet window. Marketplace
fixtures are archived immediately after their required public checks. Before
cascade deletion, the script checks for any favorite, conversation, transaction,
report, block, support reply, or support assignment involving a non-temporary
account. If it finds one, it demotes and blocks every temporary account, archives
the fixtures, and stops without cascading deletion so real-user data is retained
for manual review.

## Snapshot media retention

Media captured in a marketplace relationship snapshot is immutable evidence.
It is retained while any conversation, transaction, or report references that
captured snapshot, even if the seller later replaces the live listing image.
Retained evidence counts toward the installation-wide upload ceiling but not
the seller's personal working quota. Once every relationship reference is
deleted, the normal orphan TTL applies before the file is removed. Reconstructed
legacy snapshots are redacted and do not retain media as historical evidence.
Open reservations created before the snapshot release are preserved with a
`reconstructed` cutover snapshot after stock, type, identity, and duplicate-hold
checks pass. They settle against the same current approved inventory that the
legacy backend used; only new `captured` snapshots are presented as historical
evidence.
