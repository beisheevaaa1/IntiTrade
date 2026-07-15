import { Client } from 'ssh2';
import dotenv from 'dotenv';
import { clearSshPassword, createSshConfig } from './ssh_config.js';

dotenv.config();

const conn = new Client();
const remoteProjectDir = process.env.SERVER_PROJECT_DIR || '/var/www/university-marketplace';
const apiPort = Number.parseInt(process.env.SERVER_API_PORT || '4099', 10);

if (!/^\/[A-Za-z0-9._/-]+$/.test(remoteProjectDir) || !Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  throw new Error('Invalid SERVER_PROJECT_DIR or SERVER_API_PORT');
}

const config = createSshConfig();

conn.on('ready', () => {
  clearSshPassword(config);
  console.log('SSH client connected. Starting locked deployment transaction...');

  const script = [
    'set -Eeuo pipefail',
    'umask 027',
    'exec 9>/run/lock/intitrade-deploy.lock',
    'if ! flock -n 9; then echo "Another IntiTrade deployment is already running" >&2; exit 75; fi',
    `PROJECT_DIR=${remoteProjectDir}`,
    `API_PORT=${apiPort}`,
    'APP_GROUP="${INTITRADE_APP_GROUP:-intitrade}"',
    'BUILD_DIR=""',
    'ENV_BACKUP=""',
    'PREVIOUS_VERSION=""',
    'NGINX_TRANSACTION_DIR=""',
    'NGINX_CONFIGURED=0',
    'BACKEND_ACTIVATED=0',
    'FRONTEND_ACTIVATED=0',
    'rollback_and_cleanup() {',
    '  status=$?',
    '  trap - EXIT HUP INT TERM',
    '  set +e',
    '  if [ "$status" -ne 0 ]; then',
    '    echo "Deployment failed with status $status; restoring activated releases" >&2',
    '    if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then',
    '      cp -a -- "$ENV_BACKUP" "$PROJECT_DIR/backend/.env" || true',
    '      if getent group "$APP_GROUP" >/dev/null 2>&1; then chown "root:$APP_GROUP" "$PROJECT_DIR/backend/.env" || true; chmod 0640 "$PROJECT_DIR/backend/.env" || true; fi',
    '    fi',
    '    if [ "$FRONTEND_ACTIVATED" -eq 1 ]; then',
    '      PROJECT_DIR="$PROJECT_DIR" FRONTEND_RELEASE_MODE=rollback bash "$PROJECT_DIR/deploy/build-frontend-release.sh" || true',
    '    fi',
    '    if [ "$BACKEND_ACTIVATED" -eq 1 ]; then',
    '      PROJECT_DIR="$PROJECT_DIR" BACKEND_RELEASE_MODE=rollback bash "$PROJECT_DIR/deploy/build-backend-release.sh" || true',
    '      systemctl restart intitrade-api.service || true',
    '      recovered=0',
    '      for attempt in $(seq 1 30); do',
    '        if systemctl is-active --quiet intitrade-api.service; then',
    '          rollback_health="$(curl --fail --silent --connect-timeout 2 --max-time 5 "http://127.0.0.1:$API_PORT/api/health/ready" 2>/dev/null || curl --fail --silent --connect-timeout 2 --max-time 5 "http://127.0.0.1:$API_PORT/api/health" 2>/dev/null || true)"',
    '          if printf "%s" "$rollback_health" | grep -Eq \'"(ready|ok)":true\'; then recovered=1; break; fi',
    '        fi',
    '        sleep 1',
    '      done',
    '      if [ "$recovered" -ne 1 ]; then echo "Rollback API health verification failed" >&2; fi',
    '    fi',
    '    if [ "$NGINX_CONFIGURED" -eq 1 ] && [ -n "$NGINX_TRANSACTION_DIR" ]; then',
    '      PROJECT_DIR="$PROJECT_DIR" NGINX_MODE=rollback NGINX_TRANSACTION_DIR="$NGINX_TRANSACTION_DIR" bash "$PROJECT_DIR/deploy/configure-intitrade-nginx.sh" || true',
    '    else',
    '      systemctl reload nginx || true',
    '    fi',
    '  fi',
    '  if [ -n "$BUILD_DIR" ]; then rm -rf -- "$BUILD_DIR"; fi',
    '  if [ -n "$ENV_BACKUP" ]; then rm -f -- "$ENV_BACKUP"; fi',
    '  exit "$status"',
    '}',
    'trap rollback_and_cleanup EXIT',
    "trap 'exit 130' HUP INT TERM",

    'echo "[1/12] Verifying and updating the Git worktree"',
    'cd "$PROJECT_DIR"',
    'test -d .git',
    'PREVIOUS_VERSION="$(git rev-parse --short=12 HEAD)"',
    'if [ -f backend/.env ]; then ENV_BACKUP="/run/intitrade-env.$$.backup"; cp -a -- backend/.env "$ENV_BACKUP"; fi',
    'git diff --quiet',
    'git diff --cached --quiet',
    'git fetch origin main',
    'if git show-ref --verify --quiet refs/heads/main; then git switch main; else git switch -c main --track origin/main; fi',
    'git merge --ff-only origin/main',
    'EXPECTED_VERSION="$(git rev-parse --short=12 HEAD)"',

    'echo "[2/12] Configuring production runtime and preserving rollback releases"',
    'PROJECT_DIR="$PROJECT_DIR" BACKEND_RELEASE_MODE=preserve-current BACKEND_RELEASE_VERSION="$PREVIOUS_VERSION" bash deploy/build-backend-release.sh',
    'PROJECT_DIR="$PROJECT_DIR" SERVER_API_PORT="$API_PORT" APP_VERSION="$EXPECTED_VERSION" bash deploy/configure-production-env.sh',
    'PROJECT_DIR="$PROJECT_DIR" SERVER_API_PORT="$API_PORT" OPERATIONS_MODE=prepare bash deploy/configure-operations.sh',
    'NODE_BIN="$(command -v node)"',

    'echo "[3/12] Creating an isolated disposable build tree"',
    'BUILD_DIR="/var/lib/intitrade-build/$EXPECTED_VERSION"',
    'rm -rf -- "$BUILD_DIR"',
    'mkdir -p "$BUILD_DIR"',
    'git archive HEAD | tar -x -C "$BUILD_DIR"',
    'chown -R intitrade-build:intitrade-build "$BUILD_DIR"',

    'echo "[4/12] Building and testing the backend as the isolated build user"',
    `runuser -u intitrade-build -- env HOME=/var/lib/intitrade-build NODE_ENV=test DATABASE_URL=postgresql://build@127.0.0.1:5432/build bash -c 'cd "$1/backend" && npm ci --no-audit --no-fund && npm run build && npm test' -- "$BUILD_DIR"`,

    'echo "[5/12] Building and type-checking the frontend as the isolated build user"',
    `runuser -u intitrade-build -- env HOME=/var/lib/intitrade-build NODE_ENV=production bash -c 'cd "$1/frontend" && npm ci --include=dev --no-audit --no-fund && npm run typecheck && npm run build' -- "$BUILD_DIR"`,
    'chmod -R a+rX "$BUILD_DIR"',

    'echo "[6/12] Staging immutable backend and frontend releases"',
    'PROJECT_DIR="$PROJECT_DIR" BACKEND_BUILD_DIR="$BUILD_DIR/backend" BACKEND_RELEASE_MODE=stage bash deploy/build-backend-release.sh',
    'PROJECT_DIR="$PROJECT_DIR" FRONTEND_BUILD_DIR="$BUILD_DIR/frontend" FRONTEND_RELEASE_MODE=stage bash deploy/build-frontend-release.sh',
    'RELEASE="$(cat backend/.pending-runtime-release)"',
    `runuser -u intitrade -- env HOME=/var/lib/intitrade bash -c 'cd "$1" && node --input-type=module -e "await import(\"./dist/env.js\")"' -- "$RELEASE"`,

    'echo "[7/12] Creating a verified pre-migration backup"',
    'PROJECT_DIR="$PROJECT_DIR" bash deploy/backup-intitrade.sh',

    'echo "[8/12] Applying checked-in database migrations"',
    'runuser -u intitrade -- env -u DATABASE_URL HOME=/var/lib/intitrade NODE_ENV=production "$NODE_BIN" --env-file="$PROJECT_DIR/backend/.env" "$BUILD_DIR/backend/node_modules/prisma/build/index.js" migrate deploy --schema "$BUILD_DIR/backend/prisma/schema.prisma"',
    'runuser -u intitrade -- env -u DATABASE_URL HOME=/var/lib/intitrade NODE_ENV=production "$NODE_BIN" --env-file="$PROJECT_DIR/backend/.env" "$BUILD_DIR/backend/node_modules/prisma/build/index.js" migrate diff --from-schema-datasource="$BUILD_DIR/backend/prisma/schema.prisma" --to-schema-datamodel="$BUILD_DIR/backend/prisma/schema.prisma" --exit-code',

    'echo "[9/12] Activating and verifying the backend release"',
    'PROJECT_DIR="$PROJECT_DIR" BACKEND_RELEASE_MODE=activate bash deploy/build-backend-release.sh',
    'BACKEND_ACTIVATED=1',
    'PROJECT_DIR="$PROJECT_DIR" SERVER_API_PORT="$API_PORT" OPERATIONS_MODE=activate PROJECT_PERMISSIONS_PREPARED=1 bash deploy/configure-operations.sh',
    'if command -v pm2 >/dev/null 2>&1 && pm2 describe university-marketplace-api >/dev/null 2>&1; then pm2 delete university-marketplace-api >/dev/null 2>&1 || true; pm2 save --force >/dev/null 2>&1 || true; fi',
    'systemctl restart intitrade-api.service',
    'ready=0',
    'for attempt in $(seq 1 30); do',
    '  health="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 5 "http://127.0.0.1:$API_PORT/api/health/ready" 2>/dev/null || true)"',
    '  if systemctl is-active --quiet intitrade-api.service && printf "%s" "$health" | grep -Fq "\"ready\":true" && printf "%s" "$health" | grep -Fq "\"version\":\"$EXPECTED_VERSION\""; then ready=1; break; fi',
    '  sleep 1',
    'done',
    'if [ "$ready" -ne 1 ]; then echo "The new API release did not become ready" >&2; exit 1; fi',

    'echo "[10/12] Activating the frontend and transactional Nginx configuration"',
    'PROJECT_DIR="$PROJECT_DIR" FRONTEND_RELEASE_MODE=activate bash deploy/build-frontend-release.sh',
    'FRONTEND_ACTIVATED=1',
    'NGINX_TRANSACTION_DIR="/var/backups/nginx/intitrade-deploy-$EXPECTED_VERSION-$(date -u +%s%N)-$$"',
    'PROJECT_DIR="$PROJECT_DIR" NGINX_TRANSACTION_DIR="$NGINX_TRANSACTION_DIR" bash deploy/configure-intitrade-nginx.sh',
    'NGINX_CONFIGURED=1',

    'echo "[11/12] Running exact external release and readiness checks"',
    'expected="$(sha256sum frontend/current/index.html | awk \'{print $1}\')"',
    'primary="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 https://intitrade.shop/ | sha256sum | awk \'{print $1}\')"',
    'alternate="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 https://adelina.adilkan.com/ | sha256sum | awk \'{print $1}\')"',
    'test "$expected" = "$primary"',
    'test "$expected" = "$alternate"',
    'public_health="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 https://intitrade.shop/api/health/ready)"',
    'printf "%s" "$public_health" | grep -Fq "\"ready\":true"',
    'printf "%s" "$public_health" | grep -Fq "\"version\":\"$EXPECTED_VERSION\""',
    'systemctl is-active --quiet intitrade-api.service',

    'echo "[12/12] Recording deployment and retiring an empty root PM2 runtime"',
    `if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.exit(JSON.parse(s).length===0?0:1)}catch{process.exit(1)}})'; then pm2 kill >/dev/null 2>&1 || true; systemctl disable --now pm2-root.service >/dev/null 2>&1 || true; fi`,
    'mkdir -p /var/log/intitrade',
    `printf '{"deployedAt":"%s","commit":"%s","status":"success"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$EXPECTED_VERSION" >> /var/log/intitrade/deployments.jsonl`,
    'systemctl status intitrade-api.service --no-pager --lines=10',
    'echo "Deployment completed successfully"'
  ].join('\n');

  conn.exec('bash -s', (error, stream) => {
    if (error) {
      console.error('Could not start the remote deployment transaction:', error.message);
      process.exitCode = 1;
      conn.end();
      return;
    }

    stream.on('close', (code, signal) => {
      if (code !== 0) {
        console.error(`Deployment stopped with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`);
        process.exitCode = code || 1;
      }
      conn.end();
    }).on('data', (data) => process.stdout.write(data));
    stream.stderr.on('data', (data) => process.stderr.write(data));
    stream.end(`${script}\n`);
  });
}).connect(config);

conn.on('error', (error) => {
  console.error('SSH connection failed:', error.message);
  process.exitCode = 1;
});
