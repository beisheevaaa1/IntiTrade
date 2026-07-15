#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/university-marketplace}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/intitrade}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
OFFSITE_BACKUP_DIR="${OFFSITE_BACKUP_DIR:-}"
BACKUP_LOCK_TIMEOUT="${BACKUP_LOCK_TIMEOUT:-300}"
ENV_FILE="${PROJECT_DIR}/backend/.env"

if [[ ! -r "${ENV_FILE}" ]]; then
  echo "Cannot read ${ENV_FILE}" >&2
  exit 1
fi
if [[ ! "${BACKUP_LOCK_TIMEOUT}" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_LOCK_TIMEOUT must be a non-negative integer" >&2
  exit 1
fi

# Every caller (cron, deployment, or manual recovery) uses the same lock.
exec 8>/run/lock/intitrade-backup.lock
if ! flock -w "${BACKUP_LOCK_TIMEOUT}" 8; then
  echo "Another IntiTrade backup is already running" >&2
  exit 75
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%S%NZ)-$$"
FINAL_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
TEMP_DIR="${FINAL_DIR}.partial"
[[ ! -e "${FINAL_DIR}" && ! -e "${TEMP_DIR}" ]] || { echo "Refusing to overwrite an existing backup path" >&2; exit 1; }

umask 077
mkdir -p "${BACKUP_ROOT}"
rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup ERR INT TERM

# Keep the database password out of process arguments. pg_dump receives a
# sanitized URL and reads the credential from a mode-0600 PGPASSFILE.
export PGPASSFILE="${TEMP_DIR}/.pgpass"
export SAFE_DATABASE_URL_FILE="${TEMP_DIR}/.database-url"
env -u DATABASE_URL node --env-file="${ENV_FILE}" - <<'NODE'
const fs = require("node:fs");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("schema");
const decode = (value) => decodeURIComponent(value || "");
const pgpassEscape = (value) => value.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
const host = url.hostname || "localhost";
const port = url.port || "5432";
const database = decode(url.pathname.replace(/^\//, ""));
const user = decode(url.username);
const password = decode(url.password);
if (!database || !user) throw new Error("DATABASE_URL must include a database and user");
fs.writeFileSync(
  process.env.PGPASSFILE,
  `${pgpassEscape(host)}:${pgpassEscape(port)}:${pgpassEscape(database)}:${pgpassEscape(user)}:${pgpassEscape(password)}\n`,
  { mode: 0o600 }
);
url.password = "";
fs.writeFileSync(process.env.SAFE_DATABASE_URL_FILE, url.toString(), { mode: 0o600 });
NODE
DUMP_DATABASE_URL="$(<"${SAFE_DATABASE_URL_FILE}")"
pg_dump --dbname="${DUMP_DATABASE_URL}" --format=custom --file="${TEMP_DIR}/database.dump"
rm -f "${PGPASSFILE}" "${SAFE_DATABASE_URL_FILE}"
unset PGPASSFILE SAFE_DATABASE_URL_FILE DUMP_DATABASE_URL

if [[ -d "${PROJECT_DIR}/backend/uploads" ]]; then
  tar --ignore-failed-read --warning=no-file-changed -C "${PROJECT_DIR}/backend" -czf "${TEMP_DIR}/uploads.tar.gz" uploads
fi

# Verify that both archives are readable before publishing the backup.
pg_restore --list "${TEMP_DIR}/database.dump" >/dev/null
if [[ -f "${TEMP_DIR}/uploads.tar.gz" ]]; then
  tar -tzf "${TEMP_DIR}/uploads.tar.gz" >/dev/null
fi

backup_artifacts=(database.dump)
if [[ -f "${TEMP_DIR}/uploads.tar.gz" ]]; then
  backup_artifacts+=(uploads.tar.gz)
fi
(cd "${TEMP_DIR}" && sha256sum "${backup_artifacts[@]}") > "${TEMP_DIR}/SHA256SUMS"
mv "${TEMP_DIR}" "${FINAL_DIR}"
trap - ERR INT TERM

if [[ -n "${OFFSITE_BACKUP_DIR}" ]]; then
  offsite_partial="${OFFSITE_BACKUP_DIR}/${TIMESTAMP}.partial"
  offsite_final="${OFFSITE_BACKUP_DIR}/${TIMESTAMP}"
  mkdir -p "${OFFSITE_BACKUP_DIR}"
  rm -rf "${offsite_partial}"
  cp -a "${FINAL_DIR}" "${offsite_partial}"
  (cd "${offsite_partial}" && sha256sum --check SHA256SUMS >/dev/null)
  mv "${offsite_partial}" "${offsite_final}"
  echo "Verified offsite backup copy: ${offsite_final}"
fi

find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf -- {} +
echo "Backup completed: ${FINAL_DIR}"
