#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/university-marketplace}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/intitrade}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
ENV_FILE="${PROJECT_DIR}/backend/.env"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
TEMP_DIR="${FINAL_DIR}.partial"

if [[ ! -r "${ENV_FILE}" ]]; then
  echo "Cannot read ${ENV_FILE}" >&2
  exit 1
fi

umask 077
mkdir -p "${BACKUP_ROOT}"
rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup ERR INT TERM

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not configured" >&2
  exit 1
fi

# Prisma accepts a `schema` URL parameter that libpq/pg_dump does not.
DUMP_DATABASE_URL="$(node -e 'const url = new URL(process.env.DATABASE_URL); url.searchParams.delete("schema"); process.stdout.write(url.toString())')"
pg_dump --dbname="${DUMP_DATABASE_URL}" --format=custom --file="${TEMP_DIR}/database.dump"

if [[ -d "${PROJECT_DIR}/backend/uploads" ]]; then
  tar -C "${PROJECT_DIR}/backend" -czf "${TEMP_DIR}/uploads.tar.gz" uploads
fi

sha256sum "${TEMP_DIR}"/* > "${TEMP_DIR}/SHA256SUMS"
mv "${TEMP_DIR}" "${FINAL_DIR}"
trap - ERR INT TERM

find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf -- {} +
echo "Backup completed: ${FINAL_DIR}"
