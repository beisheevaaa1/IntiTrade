#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/university-marketplace}"
API_PORT="${SERVER_API_PORT:-4099}"
APP_USER="${INTITRADE_APP_USER:-intitrade}"
APP_GROUP="${INTITRADE_APP_GROUP:-intitrade}"
BUILD_USER="${INTITRADE_BUILD_USER:-intitrade-build}"
OFFSITE_BACKUP_DIR="${OFFSITE_BACKUP_DIR:-}"
OPERATIONS_MODE="${OPERATIONS_MODE:-activate}"
PROJECT_PERMISSIONS_PREPARED="${PROJECT_PERMISSIONS_PREPARED:-0}"

if [[ ! "${PROJECT_DIR}" =~ ^/[A-Za-z0-9._/-]+$ ]] \
  || { [[ -n "${OFFSITE_BACKUP_DIR}" ]] && [[ ! "${OFFSITE_BACKUP_DIR}" =~ ^/[A-Za-z0-9._/-]+$ ]]; }; then
  echo "PROJECT_DIR and OFFSITE_BACKUP_DIR must be absolute paths without shell metacharacters" >&2
  exit 1
fi
if [[ ! "${API_PORT}" =~ ^[0-9]+$ ]] || (( API_PORT < 1 || API_PORT > 65535 )); then
  echo "SERVER_API_PORT must be between 1 and 65535" >&2
  exit 1
fi
for account_name in "${APP_USER}" "${APP_GROUP}" "${BUILD_USER}"; do
  if [[ ! "${account_name}" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
    echo "IntiTrade account and group names contain unsupported characters" >&2
    exit 1
  fi
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "configure-operations.sh must run as root" >&2
  exit 1
fi
if [[ "${OPERATIONS_MODE}" != "prepare" && "${OPERATIONS_MODE}" != "activate" ]]; then
  echo "OPERATIONS_MODE must be prepare or activate" >&2
  exit 1
fi
if [[ "${PROJECT_PERMISSIONS_PREPARED}" != "0" && "${PROJECT_PERMISSIONS_PREPARED}" != "1" ]]; then
  echo "PROJECT_PERMISSIONS_PREPARED must be 0 or 1" >&2
  exit 1
fi

if ! getent group "${APP_GROUP}" >/dev/null; then
  groupadd --system "${APP_GROUP}"
fi
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${APP_GROUP}" --home-dir /var/lib/intitrade --create-home --shell /usr/sbin/nologin "${APP_USER}"
fi
if ! id -u "${BUILD_USER}" >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/intitrade-build --create-home --shell /usr/sbin/nologin "${BUILD_USER}"
fi

NODE_BIN="$(command -v node || true)"
NODE_REAL="$(readlink -f "${NODE_BIN}" 2>/dev/null || true)"
if [[ -z "${NODE_BIN}" || -z "${NODE_REAL}" || "${NODE_REAL}" == /root/* ]]; then
  echo "A system-wide Node.js executable accessible outside /root is required" >&2
  exit 1
fi
if ! runuser -u "${APP_USER}" -- "${NODE_BIN}" --version >/dev/null; then
  echo "Node.js is not executable by ${APP_USER}" >&2
  exit 1
fi

# Git updates and release-control symlinks are root-only operations. Remove
# legacy world-writable permissions before any untrusted npm lifecycle script
# is executed as the isolated build account.
if [[ "${PROJECT_PERMISSIONS_PREPARED}" != "1" ]]; then
  # Do not take ownership of the live upload directory while the old API is
  # still serving traffic during a zero-downtime deployment.
  find "${PROJECT_DIR}" -path "${PROJECT_DIR}/backend/uploads" -prune -o ! -type l -exec chown root:root {} +
  find "${PROJECT_DIR}" -path "${PROJECT_DIR}/backend/uploads" -prune -o ! -type l -exec chmod go-w {} +
  chmod 0755 "${PROJECT_DIR}" "${PROJECT_DIR}/backend" "${PROJECT_DIR}/frontend" "${PROJECT_DIR}/deploy"
fi

mkdir -p /var/log/intitrade /var/backups/intitrade "${PROJECT_DIR}/backend/uploads"
mkdir -p /var/lib/intitrade-build
chown "${APP_USER}:${APP_GROUP}" /var/log/intitrade /var/lib/intitrade
chown -R "${APP_USER}:${APP_GROUP}" "${PROJECT_DIR}/backend/uploads"
chmod 750 /var/log/intitrade /var/backups/intitrade /var/lib/intitrade "${PROJECT_DIR}/backend/uploads"
chown "${BUILD_USER}:${BUILD_USER}" /var/lib/intitrade-build
chmod 755 /var/lib/intitrade-build
chown "root:${APP_GROUP}" "${PROJECT_DIR}/backend/.env"
chmod 640 "${PROJECT_DIR}/backend/.env"

if [[ "${OPERATIONS_MODE}" == "prepare" ]]; then
  echo "IntiTrade users, directories, and project permissions prepared"
  exit 0
fi

cat > /etc/logrotate.d/intitrade <<'EOF'
/var/log/intitrade/*.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
  create 0640 root root
}
EOF

backup_environment="PROJECT_DIR=${PROJECT_DIR} RETENTION_DAYS=14"
if [[ -n "${OFFSITE_BACKUP_DIR}" ]]; then
  backup_environment+=" OFFSITE_BACKUP_DIR=${OFFSITE_BACKUP_DIR}"
fi

cat > /etc/cron.d/intitrade-backup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3 * * * root env ${backup_environment} BACKUP_LOCK_TIMEOUT=0 bash ${PROJECT_DIR}/deploy/backup-intitrade.sh >>/var/log/intitrade/backup.log 2>&1
EOF

cat > /usr/local/sbin/intitrade-healthcheck <<EOF
#!/usr/bin/env bash
set -euo pipefail
if curl --fail --silent --max-time 10 http://127.0.0.1:${API_PORT}/api/health/ready | grep -Fq '"ready":true'; then
  :
elif [[ "\$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 http://127.0.0.1:${API_PORT}/api/health/ready)" == "404" ]]; then
  curl --fail --silent --max-time 10 http://127.0.0.1:${API_PORT}/api/health | grep -Fq '"ok":true'
else
  exit 1
fi
disk_used="\$(df -P ${PROJECT_DIR}/backend/uploads | awk 'NR==2 { gsub(/%/, "", \$5); print \$5 }')"
[[ "\${disk_used}" -lt 90 ]]
EOF
chmod 750 /usr/local/sbin/intitrade-healthcheck

cat > /etc/systemd/system/intitrade-api.service <<EOF
[Unit]
Description=IntiTrade API
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
Environment=NODE_ENV=production
Environment=PROJECT_DIR=${PROJECT_DIR}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
WorkingDirectory=${PROJECT_DIR}/backend/runtime-current
ExecStart=${NODE_BIN} ${PROJECT_DIR}/backend/runtime-current/dist/index.js
Restart=always
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM
MemoryMax=512M
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=/var/log/intitrade /var/lib/intitrade ${PROJECT_DIR}/backend/uploads

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable intitrade-api.service >/dev/null

cat > /etc/cron.d/intitrade-health <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/5 * * * * root flock -n /run/lock/intitrade-health.lock /usr/local/sbin/intitrade-healthcheck || logger -t intitrade-health "API readiness check failed"
EOF

cat > /etc/cron.d/intitrade-upload-cleanup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
23 * * * * root find ${PROJECT_DIR}/backend/uploads -maxdepth 1 -type f -name '*.upload' -mmin +60 -delete
41 * * * * root flock -n /run/lock/intitrade-backup.lock runuser -u ${APP_USER} -- bash -c 'cd ${PROJECT_DIR}/backend/runtime-current && { test ! -f dist/scripts/cleanupUploads.js || node dist/scripts/cleanupUploads.js; }' >>/var/log/intitrade/upload-cleanup.log 2>&1
EOF

chmod 644 /etc/logrotate.d/intitrade /etc/cron.d/intitrade-backup /etc/cron.d/intitrade-health /etc/cron.d/intitrade-upload-cleanup
echo "IntiTrade service isolation, log rotation, daily backup, and local readiness monitor configured"
