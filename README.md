# IntiTrade

A university marketplace for INTI students: products, courses and services, announcements, private messaging, ratings, favorites, support, and mandatory moderation of postings.

## Structure

```text
backend/   Express + TypeScript + Prisma + PostgreSQL + Socket.IO
frontend/  React + Vite + Tailwind CSS + Playwright
deploy/    atomic releases, Nginx, systemd, backup and monitoring
docs/      project documentation
```

## Local setup

Requirements: Node.js 20+, npm, and PostgreSQL 16+.

On Windows the entire project can be started with a single command from the repository root:

```powershell
.\manage.ps1
```

The script installs any missing dependencies, applies Prisma migrations, and starts the backend and frontend in the background. Available commands:

```powershell
.\manage.ps1 start                 # Start the project (default command)
.\manage.ps1 stop                  # Stop the project and the managed Docker PostgreSQL
.\manage.ps1 restart               # Restart
.\manage.ps1 status                # Show status
.\manage.ps1 logs                  # Last log lines
.\manage.ps1 logs -Follow          # Follow the logs
.\manage.ps1 start -OpenBrowser    # Start and open the site
.\manage.ps1 start -Database docker   # Explicitly use Docker PostgreSQL
.\manage.ps1 start -Database external # Use the PostgreSQL from backend/.env
```

In `auto` mode, an existing available PostgreSQL is used without Docker. If a local PostgreSQL is unavailable but Docker Desktop is running, the script automatically configures Docker PostgreSQL and saves a backup of the previous `backend/.env` in `.manage/`. To disable automatic switching, use `-Database external`.

```bash
cd backend
npm ci
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The backend is available at `http://localhost:4000`, the frontend at `http://localhost:5173`, and Swagger at `http://localhost:4000/api/docs`.

Browser authentication uses a host-only cookie `intitrade_session` with `HttpOnly` and `SameSite=Lax`; in production `Secure` is also enabled. Bearer JWT is kept only for compatibility with API clients. The frontend does not store the token in `localStorage`.

## Test data

The seed completely wipes the data, so it is forbidden in production and only runs with explicit confirmation. Do not use real passwords:

```bash
ALLOW_DESTRUCTIVE_SEED=true \
SEED_ADMIN_EMAIL=admin@example.test \
SEED_ADMIN_PASSWORD='replace-with-a-unique-test-password' \
SEED_STUDENT_PASSWORD='replace-with-another-test-password' \
npm run seed
```

Seed passwords must be 12–72 bytes long. There is no default administrator password in the repository.

## Checks

```bash
cd backend
npm run build
npm test
npm audit --audit-level=high

cd ../frontend
npm run typecheck
npm run build
npm run test:e2e:install
npm run test:e2e
npm audit --audit-level=high
```

Playwright tests desktop Chromium and mobile Pixel 7. The API is mocked in E2E, so the tests do not create production data.

GitHub Actions additionally checks Prisma, the initial JavaScript budget, the absence of new credentials, and runs a production smoke check every 15 minutes.

## Docker for local PostgreSQL only

```bash
cp docker-compose.env.example .env
# set a unique POSTGRES_PASSWORD in .env
docker compose up -d postgres
```

PostgreSQL is published only on `127.0.0.1`; the `.env` file must not be committed to Git.

## Production and observability

- `GET /api/health/live` — the API process is running.
- `GET /api/health/ready` — the API and PostgreSQL are ready; the result is briefly cached.
- Admin panel → **System Health** — requests, memory, WebSocket, and anonymized errors.
- Admin panel → **Audit Log** — an immutable moderation journal.
- Admin panel → **Support** — user tickets and support replies.
- `/support` — the user's private tickets.
- A posting appears on the marketplace only after admin approval.

The production API runs as a dedicated system user `intitrade`, listens on localhost only, and is started via systemd. Nginx adds rate limits, CSP, HSTS, and the remaining browser security headers.

## Deployment

Before running, set `SSH_HOST`, `SSH_USER`, `SSH_HOST_FINGERPRINTS` locally, and one login method: `SSH_PRIVATE_KEY_PATH` (preferred) or `SSH_PASSWORD`. If needed, also set `SERVER_PROJECT_DIR` and `SERVER_API_PORT`.

```bash
node backend/ssh_preflight.js
node backend/ssh_deploy.js
```

The deployment pins verified SSH fingerprints, builds the code as an isolated build user without access to the production DB, runs the tests, executes the optional read-only hook `backend/prisma/predeploy-data-checks.sql`, takes a verified backup, applies migrations, and atomically switches the backend/frontend releases. The predeploy hook must only read data and must fail if prerequisites are violated; the runner additionally wraps it in a PostgreSQL `TRANSACTION READ ONLY`. The check runs before the backup, is repeated immediately after it, and once more after writes are stopped. Therefore a normal failure leaves the old API and schema unchanged, while the two repeated checks close the race with user actions. The backend release contains an immutable `.schema-compatibility`, and the state of the production schema and of any unfinished transition is stored separately from the working copy in `/var/lib/intitrade-deploy`.

Rollback is chosen by compatibility, not only by an HTTP health check:

- before migrations begin, the old backend remains unchanged;
- after a compatible migration, only a release with the same schema marker can be restored;
- after a completed incompatible migration, the deployment rolls forward to the new verified backend, even if the frontend/Nginx check did not pass;
- before an incompatible migration, the API enters an explicit persistent maintenance mode and responds with `503` and `DEPLOYMENT_MAINTENANCE`; the old upload-cleanup cron is stopped under the same lock used by media cleanup;
- after a completed migration, only the compatible new backend is started, and if the transition was interrupted, maintenance mode is preserved after the deploy process exits and after a server reboot. The old backend cannot expose drafts or delete snapshot media.

`deploy/backend-schema-compatibility` is conservatively tied to the name of the latest Prisma migration and changes with every new migration; CI enforces this rule. Therefore compatibility is never assumed automatically, even for a migration that looks additive. You must not manually assign a new marker to an old release.

Safe-recovery state on the server:

```bash
cat /var/lib/intitrade-deploy/schema-compatibility
cat /var/lib/intitrade-deploy/schema-compatibility.pending 2>/dev/null || true
cat /var/lib/intitrade-deploy/maintenance.json 2>/dev/null || true
cat /var/www/university-marketplace/backend/runtime-current/.schema-compatibility 2>/dev/null || echo legacy
systemctl status intitrade-api.service intitrade-maintenance.service --no-pager
```

To exit maintenance mode, re-run the normal release deploy with the marker specified in `schema-compatibility.pending`. The script re-checks the migrations idempotently, starts the compatible backend, and only removes the maintenance marker after readiness. `build-backend-release.sh` requires `BACKEND_REQUIRED_SCHEMA_COMPATIBILITY` for activation/rollback and refuses to switch to an incompatible runtime; `ExecStartPre` in systemd independently repeats the marker check and blocks startup if there is a pending migration. Raw symlink switching is forbidden. A frontend rollback does not change this rule.

## Backup

`deploy/backup-intitrade.sh` creates a PostgreSQL dump and an archive of uploads, verifies that they can be read, and stores SHA-256 checksums. By default, local copies are kept for 14 days in `/var/backups/intitrade`.

For a second verified copy on a separate mounted storage, set `OFFSITE_BACKUP_DIR` when running the script or in the cron configuration. A directory on the same disk is not considered an offsite backup.

## Configuration security

- Never add `.env`, SSH private keys, passwords, or DB dumps to Git.
- After a credential leak, first replace it in the running system, then clean up the Git history consistently.
- The production `JWT_SECRET` must be unique and at least 32 characters long.
- Production registration requires a demo code shown on screen. Real email delivery can be enabled later via `EMAIL_VERIFICATION_DELIVERY=email` after configuring SMTP.

Repository: https://github.com/beisheevaaa1/IntiTrade
