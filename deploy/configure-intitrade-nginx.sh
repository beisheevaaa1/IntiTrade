#!/usr/bin/env bash
set -Eeuo pipefail

CONFIG_FILE="${NGINX_CONFIG_FILE:-/etc/nginx/sites-enabled/university-marketplace}"
BACKUP_DIR="${NGINX_BACKUP_DIR:-/var/backups/nginx}"

if [[ ! -f "${CONFIG_FILE}" ]] || ! grep -q "server_name intitrade.shop" "${CONFIG_FILE}"; then
  echo "IntiTrade Nginx configuration was not found at ${CONFIG_FILE}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

# Older deployments placed backups inside sites-enabled, where Nginx loaded
# them as duplicate virtual hosts. Move those files out before validation.
find "$(dirname "${CONFIG_FILE}")" -maxdepth 1 -type f -name "$(basename "${CONFIG_FILE}").bak.*" -exec mv -t "${BACKUP_DIR}" -- {} + 2>/dev/null || true

BACKUP_FILE="${BACKUP_DIR}/$(basename "${CONFIG_FILE}").$(date -u +%Y%m%dT%H%M%SZ).conf"
cp --preserve=mode,ownership,timestamps "${CONFIG_FILE}" "${BACKUP_FILE}"

if ! grep -q "client_max_body_size" "${CONFIG_FILE}"; then
  sed -i '0,/server {/s//server {\n    client_max_body_size 110m;/' "${CONFIG_FILE}"
fi

if ! nginx -t; then
  cp --preserve=mode,ownership,timestamps "${BACKUP_FILE}" "${CONFIG_FILE}"
  echo "Nginx validation failed; restored ${BACKUP_FILE}" >&2
  exit 1
fi

systemctl reload nginx
echo "IntiTrade Nginx upload limit is configured; backup: ${BACKUP_FILE}"
