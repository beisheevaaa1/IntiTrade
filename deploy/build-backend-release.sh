#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/university-marketplace}"
BACKEND_DIR="${PROJECT_DIR}/backend"
BACKEND_BUILD_DIR="${BACKEND_BUILD_DIR:-${BACKEND_DIR}}"
RELEASES_DIR="${BACKEND_DIR}/.runtime-releases"
CURRENT_LINK="${BACKEND_DIR}/runtime-current"
NEXT_LINK="${BACKEND_DIR}/.runtime-next"
PENDING_FILE="${BACKEND_DIR}/.pending-runtime-release"
PREVIOUS_FILE="${BACKEND_DIR}/.previous-runtime-release"
KEEP_RELEASES="${KEEP_BACKEND_RELEASES:-3}"
MODE="${BACKEND_RELEASE_MODE:-stage}"

validate_release() {
  local release_dir="$1"
  [[ "${release_dir}" == "${RELEASES_DIR}/"* ]] \
    && [[ -s "${release_dir}/dist/index.js" ]] \
    && [[ -d "${release_dir}/node_modules" ]] \
    && [[ -s "${release_dir}/.app-version" ]]
}

update_runtime_version() {
  local release_dir="$1"
  local version
  version="$(<"${release_dir}/.app-version")"
  [[ "${version}" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Invalid backend release version" >&2; exit 1; }
  if grep -q '^APP_VERSION=' "${BACKEND_DIR}/.env"; then
    sed -i "s|^APP_VERSION=.*|APP_VERSION=\"${version}\"|" "${BACKEND_DIR}/.env"
  else
    printf '\nAPP_VERSION="%s"\n' "${version}" >> "${BACKEND_DIR}/.env"
  fi
}

link_runtime_data() {
  local release_dir="$1"
  ln -s "${BACKEND_DIR}/.env" "${release_dir}/.env"
  ln -s "${BACKEND_DIR}/uploads" "${release_dir}/uploads"
}

copy_runtime() {
  local release_dir="$1"
  local source_dir="${2:-${BACKEND_DIR}}"
  local version="${3:-${BACKEND_RELEASE_VERSION:-$(git -C "${PROJECT_DIR}" rev-parse --short=12 HEAD)}}"
  [[ "${version}" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Invalid backend release version" >&2; exit 1; }
  mkdir -p "${release_dir}"
  cp -a "${source_dir}/dist" "${release_dir}/dist"
  # Keep releases independent from the disposable build tree so the build
  # user cannot mutate an active or rollback runtime through shared inodes.
  cp -a --reflink=auto "${source_dir}/node_modules" "${release_dir}/node_modules"
  cp "${source_dir}/package.json" "${source_dir}/package-lock.json" "${release_dir}/"
  printf '%s\n' "${version}" > "${release_dir}/.app-version"
  link_runtime_data "${release_dir}"
  chown -R root:root "${release_dir}"
  # The runtime stays root-owned and immutable, but the unprivileged API
  # account must be able to traverse directories and read its code.
  chmod -R a+rX,u-w,go-w "${release_dir}"
}

switch_current() {
  local release_dir="$1"
  validate_release "${release_dir}" || { echo "Invalid backend release: ${release_dir}" >&2; exit 1; }
  rm -f "${NEXT_LINK}"
  ln -s "${release_dir}" "${NEXT_LINK}"
  mv -Tf "${NEXT_LINK}" "${CURRENT_LINK}"
  update_runtime_version "${release_dir}"
}

mkdir -p "${RELEASES_DIR}" "${BACKEND_DIR}/uploads"
chown root:root "${RELEASES_DIR}"
chmod 0755 "${RELEASES_DIR}"

if [[ "${MODE}" == "preserve-current" ]]; then
  if [[ -e "${CURRENT_LINK}" ]]; then
    validate_release "$(readlink -f "${CURRENT_LINK}")" || { echo "Existing backend runtime link is invalid" >&2; exit 1; }
    exit 0
  fi
  [[ -s "${BACKEND_DIR}/dist/index.js" && -d "${BACKEND_DIR}/node_modules" ]] \
    || { echo "The currently running backend cannot be preserved" >&2; exit 1; }
  legacy_release="${RELEASES_DIR}/legacy-$(date -u +%Y%m%dT%H%M%SZ)"
  copy_runtime "${legacy_release}"
  switch_current "${legacy_release}"
  echo "Current backend runtime preserved: ${legacy_release}"
  exit 0
fi

if [[ "${MODE}" == "activate" ]]; then
  [[ -s "${PENDING_FILE}" ]] || { echo "No staged backend release" >&2; exit 1; }
  release_dir="$(<"${PENDING_FILE}")"
  previous="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"
  validate_release "${previous}" || { echo "No valid current backend release is available for rollback" >&2; exit 1; }
  printf '%s\n' "${previous}" > "${PREVIOUS_FILE}"
  switch_current "${release_dir}"
  rm -f "${PENDING_FILE}"
  echo "Backend release activated: ${release_dir}"
  exit 0
fi

if [[ "${MODE}" == "rollback" ]]; then
  [[ -s "${PREVIOUS_FILE}" ]] || { echo "No previous backend release is available" >&2; exit 1; }
  previous="$(<"${PREVIOUS_FILE}")"
  switch_current "${previous}"
  echo "Backend rolled back to: ${previous}"
  exit 0
fi

if [[ "${MODE}" != "stage" ]]; then
  echo "Unknown BACKEND_RELEASE_MODE: ${MODE}" >&2
  exit 1
fi

[[ -s "${BACKEND_BUILD_DIR}/dist/index.js" && -d "${BACKEND_BUILD_DIR}/node_modules" ]] \
  || { echo "Build the backend before staging a runtime release" >&2; exit 1; }

GIT_SHA="$(git -C "${PROJECT_DIR}" rev-parse --short=12 HEAD)"
RELEASE_DIR="${RELEASES_DIR}/${GIT_SHA}-$(date -u +%Y%m%dT%H%M%SZ)"
rm -rf "${RELEASE_DIR}"
copy_runtime "${RELEASE_DIR}" "${BACKEND_BUILD_DIR}"
printf '%s\n' "${RELEASE_DIR}" > "${PENDING_FILE}"
echo "Backend release staged: ${RELEASE_DIR}"

current_target="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"
previous_target="$(cat "${PREVIOUS_FILE}" 2>/dev/null || true)"
mapfile -t old_releases < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n "+$((KEEP_RELEASES + 1))" | cut -d' ' -f2-)
for old_release in "${old_releases[@]}"; do
  if [[ "${old_release}" != "${RELEASE_DIR}" && "${old_release}" != "${current_target}" && "${old_release}" != "${previous_target}" ]]; then
    rm -rf -- "${old_release}"
  fi
done
