#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/university-marketplace}"
ENV_FILE="${PROJECT_DIR}/backend/.env"

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
upsert TRUST_PROXY 1
upsert EMAIL_VERIFICATION_REQUIRED false

chmod 600 "${ENV_FILE}"
echo "Production runtime settings updated in ${ENV_FILE}"
