#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/university-marketplace}"
STATE_DIR="${INTITRADE_DEPLOY_STATE_DIR:-/var/lib/intitrade-deploy}"
RUNTIME_LINK="${PROJECT_DIR}/backend/runtime-current"
STATE_FILE="${STATE_DIR}/schema-compatibility"
PENDING_FILE="${STATE_DIR}/schema-compatibility.pending"

if [[ ! "${PROJECT_DIR}" =~ ^/[A-Za-z0-9._/-]+$ ]] || [[ ! "${STATE_DIR}" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "Schema compatibility paths are invalid" >&2
  exit 1
fi

if [[ -e "${PENDING_FILE}" ]]; then
  echo "Refusing to start the API while a database migration transition is pending" >&2
  exit 1
fi

runtime_dir="$(readlink -f "${RUNTIME_LINK}" 2>/dev/null || true)"
[[ -n "${runtime_dir}" && -d "${runtime_dir}" ]] || { echo "The active backend runtime is missing" >&2; exit 1; }

runtime_compatibility="legacy"
database_compatibility="legacy"
if [[ -s "${runtime_dir}/.schema-compatibility" ]]; then
  runtime_compatibility="$(<"${runtime_dir}/.schema-compatibility")"
fi
if [[ -s "${STATE_FILE}" ]]; then
  database_compatibility="$(<"${STATE_FILE}")"
fi

valid_compatibility='^[a-z0-9][a-z0-9._-]{2,63}$'
[[ "${runtime_compatibility}" =~ ${valid_compatibility} ]] \
  && [[ "${database_compatibility}" =~ ${valid_compatibility} ]] \
  || { echo "Schema compatibility metadata is invalid" >&2; exit 1; }

[[ "${runtime_compatibility}" == "${database_compatibility}" ]] || {
  echo "Refusing to start incompatible backend runtime: release=${runtime_compatibility}, database=${database_compatibility}" >&2
  exit 1
}
