#!/usr/bin/env bash
set -Eeuo pipefail

CONFIG_FILE="${NGINX_CONFIG_FILE:-/etc/nginx/sites-enabled/university-marketplace}"
BACKUP_DIR="${NGINX_BACKUP_DIR:-/var/backups/nginx}"
RATE_LIMIT_FILE="/etc/nginx/conf.d/intitrade-rate-limit.conf"
SECURITY_FILE="/etc/nginx/snippets/intitrade-security.conf"
CLOUDFLARE_FILE="/etc/nginx/snippets/intitrade-cloudflare-real-ip.conf"
MODE="${NGINX_MODE:-apply}"

if [[ ! -f "${CONFIG_FILE}" ]] || ! grep -q "server_name intitrade.shop" "${CONFIG_FILE}"; then
  echo "IntiTrade Nginx configuration was not found at ${CONFIG_FILE}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}" /etc/nginx/snippets

FRONTEND_DIR="${PROJECT_DIR:-/var/www/university-marketplace}/frontend"
if [[ ! -e "${FRONTEND_DIR}/current" ]]; then
  if [[ ! -d "${FRONTEND_DIR}/dist" ]]; then
    echo "Neither ${FRONTEND_DIR}/current nor the legacy dist directory exists" >&2
    exit 1
  fi
  ln -s "${FRONTEND_DIR}/dist" "${FRONTEND_DIR}/current"
fi

LEGACY_ROOT="root /var/www/university-marketplace/frontend/dist;"
EXPECTED_ROOT="root ${FRONTEND_DIR}/current;"

# Older deployments placed backups inside sites-enabled, where Nginx loaded
# them as duplicate virtual hosts. Move those files out before validation.
find "$(dirname "${CONFIG_FILE}")" -maxdepth 1 -type f -name "$(basename "${CONFIG_FILE}").bak.*" -exec mv -t "${BACKUP_DIR}" -- {} + 2>/dev/null || true

# Establish a known-good baseline before starting a new configuration transaction.
if [[ "${MODE}" != "rollback" ]] && ! nginx -t; then
  echo "Existing Nginx configuration is invalid; no IntiTrade configuration was changed" >&2
  exit 1
fi

TRANSACTION_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
TRANSACTION_DIR="${NGINX_TRANSACTION_DIR:-${BACKUP_DIR}/intitrade-${TRANSACTION_ID}}"
if [[ ! "${TRANSACTION_DIR}" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "NGINX_TRANSACTION_DIR must be an absolute path without shell metacharacters" >&2
  exit 1
fi

backup_file() {
  local source="$1"
  local label="$2"
  if [[ -e "${source}" || -L "${source}" ]]; then
    cp --dereference --preserve=mode,ownership,timestamps -- "${source}" "${TRANSACTION_DIR}/${label}"
  else
    : > "${TRANSACTION_DIR}/${label}.absent"
  fi
}

restore_file() {
  local target="$1"
  local label="$2"
  if [[ -f "${TRANSACTION_DIR}/${label}.absent" ]]; then
    rm -f -- "${target}"
  else
    cp --preserve=mode,ownership,timestamps -- "${TRANSACTION_DIR}/${label}" "${target}"
  fi
}

RATE_LIMIT_TEMP=""
SECURITY_TEMP=""
CLOUDFLARE_TEMP=""

cleanup_temporary_files() {
  [[ -z "${RATE_LIMIT_TEMP}" ]] || rm -f -- "${RATE_LIMIT_TEMP}"
  [[ -z "${SECURITY_TEMP}" ]] || rm -f -- "${SECURITY_TEMP}"
  [[ -z "${CLOUDFLARE_TEMP}" ]] || rm -f -- "${CLOUDFLARE_TEMP}"
}

restore_transaction() {
  trap - ERR INT TERM
  local restore_failed=0
  cleanup_temporary_files || restore_failed=1
  restore_file "${CONFIG_FILE}" site.conf || restore_failed=1
  restore_file "${RATE_LIMIT_FILE}" rate-limit.conf || restore_failed=1
  restore_file "${SECURITY_FILE}" security.conf || restore_failed=1
  restore_file "${CLOUDFLARE_FILE}" cloudflare-real-ip.conf || restore_failed=1

  # A rollback is not complete until the restored configuration validates.
  if nginx -t; then
    systemctl reload nginx || restore_failed=1
  else
    echo "CRITICAL: restored Nginx configuration does not validate" >&2
    restore_failed=1
  fi
  return "${restore_failed}"
}

if [[ "${MODE}" == "rollback" ]]; then
  [[ -d "${TRANSACTION_DIR}" ]] || { echo "Nginx rollback transaction was not found: ${TRANSACTION_DIR}" >&2; exit 1; }
  restore_transaction
  echo "IntiTrade Nginx configuration rolled back from ${TRANSACTION_DIR}"
  exit 0
fi
if [[ "${MODE}" != "apply" ]]; then
  echo "NGINX_MODE must be apply or rollback" >&2
  exit 1
fi

mkdir -p "${TRANSACTION_DIR}"
backup_file "${CONFIG_FILE}" site.conf
backup_file "${RATE_LIMIT_FILE}" rate-limit.conf
backup_file "${SECURITY_FILE}" security.conf
backup_file "${CLOUDFLARE_FILE}" cloudflare-real-ip.conf

abort_transaction() {
  local message="$1"
  echo "${message}" >&2
  if ! restore_transaction; then
    echo "CRITICAL: Nginx rollback was incomplete; inspect ${TRANSACTION_DIR}" >&2
  fi
  exit 1
}

handle_error() {
  local status=$?
  echo "Nginx configuration failed unexpectedly; restoring ${TRANSACTION_DIR}" >&2
  if ! restore_transaction; then
    echo "CRITICAL: Nginx rollback was incomplete; inspect ${TRANSACTION_DIR}" >&2
  fi
  exit "${status}"
}

handle_signal() {
  local status="$1"
  echo "Nginx configuration was interrupted; restoring ${TRANSACTION_DIR}" >&2
  if ! restore_transaction; then
    echo "CRITICAL: Nginx rollback was incomplete; inspect ${TRANSACTION_DIR}" >&2
  fi
  exit "${status}"
}

trap handle_error ERR
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

CLOUDFLARE_TEMP="$(mktemp /etc/nginx/snippets/.intitrade-cloudflare-real-ip.XXXXXX)"
cat > "${CLOUDFLARE_TEMP}" <<'EOF'
# Cloudflare IP ranges: https://www.cloudflare.com/ips/
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
EOF
chmod 644 "${CLOUDFLARE_TEMP}"
mv -f -- "${CLOUDFLARE_TEMP}" "${CLOUDFLARE_FILE}"
CLOUDFLARE_TEMP=""

RATE_LIMIT_TEMP="$(mktemp /etc/nginx/conf.d/.intitrade-rate-limit.XXXXXX)"
cat > "${RATE_LIMIT_TEMP}" <<'EOF'
map $request_uri $intitrade_auth_limit_key {
    default "";
    ~^/api/auth/(?:login|register|verify-email|resend-verification) $binary_remote_addr;
}
map $request_uri $intitrade_upload_limit_key {
    default "";
    ~^/api/uploads $binary_remote_addr;
}
limit_req_zone $intitrade_auth_limit_key zone=intitrade_auth:10m rate=10r/m;
limit_req_zone $intitrade_upload_limit_key zone=intitrade_upload:10m rate=30r/m;
EOF
chmod 644 "${RATE_LIMIT_TEMP}"
mv -f -- "${RATE_LIMIT_TEMP}" "${RATE_LIMIT_FILE}"
RATE_LIMIT_TEMP=""

SECURITY_TEMP="$(mktemp /etc/nginx/snippets/.intitrade-security.XXXXXX)"
cat > "${SECURITY_TEMP}" <<'EOF'
include /etc/nginx/snippets/intitrade-cloudflare-real-ip.conf;
client_max_body_size 30m;
server_tokens off;
limit_req_status 429;
limit_req zone=intitrade_auth burst=10 nodelay;
limit_req zone=intitrade_upload burst=30 nodelay;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://intitrade.shop https://adelina.adilkan.com wss://intitrade.shop wss://adelina.adilkan.com; upgrade-insecure-requests" always;
EOF
chmod 644 "${SECURITY_TEMP}"
mv -f -- "${SECURITY_TEMP}" "${SECURITY_FILE}"
SECURITY_TEMP=""

# Put the same upload limit and browser protections on every HTTP/HTTPS block
# in this dedicated IntiTrade site file. Remove the legacy inline limit first
# so Nginx never sees a duplicate directive in one context.
sed -i '/^[[:space:]]*client_max_body_size[[:space:]]/d' "${CONFIG_FILE}"
if ! grep -Fq 'include /etc/nginx/snippets/intitrade-security.conf;' "${CONFIG_FILE}"; then
  sed -i '/^[[:space:]]*server[[:space:]]*{/a\    include /etc/nginx/snippets/intitrade-security.conf;' "${CONFIG_FILE}"
fi

# Serve the atomically switched frontend release. This replacement is scoped
# to the known IntiTrade project path and leaves other virtual hosts untouched.
if grep -Fq "${EXPECTED_ROOT}" "${CONFIG_FILE}"; then
  :
elif grep -Fq "${LEGACY_ROOT}" "${CONFIG_FILE}"; then
  root_line="$(grep -nF -m1 "${LEGACY_ROOT}" "${CONFIG_FILE}" | cut -d: -f1)"
  sed -i "${root_line}s|${LEGACY_ROOT}|${EXPECTED_ROOT}|" "${CONFIG_FILE}"
else
  abort_transaction "Expected IntiTrade frontend root was not found"
fi

grep -Fq "${EXPECTED_ROOT}" "${CONFIG_FILE}" \
  || abort_transaction "Nginx frontend root replacement could not be verified"

if ! nginx -t; then
  abort_transaction "Nginx validation failed"
fi

if ! systemctl reload nginx; then
  abort_transaction "Nginx reload failed"
fi

trap - ERR INT TERM
cleanup_temporary_files
echo "IntiTrade Nginx configuration applied transactionally; backup: ${TRANSACTION_DIR}"
