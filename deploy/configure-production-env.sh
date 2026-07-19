#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/university-marketplace}"
ENV_FILE="${PROJECT_DIR}/backend/.env"
API_PORT="${SERVER_API_PORT:-4099}"

if [[ ! "${API_PORT}" =~ ^[0-9]+$ ]] || (( API_PORT < 1 || API_PORT > 65535 )); then
  echo "SERVER_API_PORT must be between 1 and 65535" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

upsert() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "${ENV_FILE}"
  else
    printf '\n%s="%s"\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

upsert NODE_ENV production
upsert HOST 127.0.0.1
upsert PORT "${API_PORT}"
upsert TRUST_PROXY 1
upsert EMAIL_VERIFICATION_REQUIRED true
upsert EMAIL_VERIFICATION_DELIVERY screen
upsert ALLOWED_EMAIL_DOMAINS ""
upsert ALLOWED_EMAIL_DOMAIN ""
upsert APP_VERSION "${APP_VERSION:-unknown}"
upsert LOG_LEVEL info
upsert READINESS_TIMEOUT_MS 2000
upsert READINESS_CACHE_MS 5000
upsert SESSION_COOKIE_MAX_AGE_SECONDS 604800
upsert UPLOAD_MAX_VIDEO_MB 25
upsert UPLOAD_MAX_USER_MB 250
upsert UPLOAD_MAX_TOTAL_MB 5000
upsert UPLOAD_ORPHAN_TTL_HOURS 24
upsert CLIENT_URL "https://intitrade.shop"
upsert API_URL "https://intitrade.shop"
upsert CLIENT_URLS "https://intitrade.shop,https://www.intitrade.shop,https://adelina.adilkan.com"

chmod 600 "${ENV_FILE}"
echo "Production runtime settings updated in ${ENV_FILE}"
