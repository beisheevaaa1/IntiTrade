#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/university-marketplace}"
FRONTEND_DIR="${PROJECT_DIR}/frontend"
FRONTEND_BUILD_DIR="${FRONTEND_BUILD_DIR:-}"
RELEASES_DIR="${FRONTEND_DIR}/.releases"
KEEP_RELEASES="${KEEP_FRONTEND_RELEASES:-5}"
MODE="${FRONTEND_RELEASE_MODE:-build-and-activate}"
PENDING_FILE="${FRONTEND_DIR}/.pending-release"
PREVIOUS_FILE="${FRONTEND_DIR}/.previous-release"
NEXT_LINK="${FRONTEND_DIR}/.current-next"

activate_release() {
  local release_dir="$1"
  if [[ "${release_dir}" != "${RELEASES_DIR}/"* ]] || [[ ! -s "${release_dir}/index.html" ]]; then
    echo "Refusing to activate invalid frontend release: ${release_dir}" >&2
    exit 1
  fi
  local previous=""
  if [[ -e "${FRONTEND_DIR}/current" ]]; then
    previous="$(readlink -f "${FRONTEND_DIR}/current")"
  fi
  printf '%s\n' "${previous}" > "${PREVIOUS_FILE}"
  rm -f "${NEXT_LINK}"
  ln -s "${release_dir}" "${NEXT_LINK}"
  mv -Tf "${NEXT_LINK}" "${FRONTEND_DIR}/current"
  rm -f "${PENDING_FILE}"
  echo "Frontend release activated: ${release_dir}"
}

stamp_release() {
  local html_file="$1"
  local version="$2"
  local node_bin
  node_bin="$(command -v node)"
  HTML_FILE="${html_file}" RELEASE_VERSION="${version}" "${node_bin}" --eval '
    const fs = require("node:fs");
    const htmlFile = process.env.HTML_FILE;
    const version = process.env.RELEASE_VERSION;
    let html = fs.readFileSync(htmlFile, "utf8");
    html = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["\x27]intitrade-release["\x27])[^>]*>\s*/gi, "");
    if (!/<\/head>/i.test(html)) throw new Error("Frontend index is missing </head>");
    const marker = `  <meta name="intitrade-release" content="${version}">`;
    fs.writeFileSync(htmlFile, html.replace(/<\/head>/i, `${marker}\n</head>`));
  '
}

if [[ "${MODE}" == "activate" ]]; then
  [[ -s "${PENDING_FILE}" ]] || { echo "No staged frontend release" >&2; exit 1; }
  activate_release "$(<"${PENDING_FILE}")"
  exit 0
fi

if [[ "${MODE}" == "rollback" ]]; then
  if [[ -n "${FRONTEND_ROLLBACK_TARGET:-}" ]]; then
    previous="${FRONTEND_ROLLBACK_TARGET}"
  else
    [[ -s "${PREVIOUS_FILE}" ]] || { echo "No previous frontend release is available" >&2; exit 1; }
    previous="$(<"${PREVIOUS_FILE}")"
  fi
  [[ "${previous}" == "${RELEASES_DIR}/"* || "${previous}" == "${FRONTEND_DIR}/dist" ]] \
    || { echo "Previous frontend release is outside the managed release directories" >&2; exit 1; }
  [[ -s "${previous}/index.html" ]] || { echo "Previous frontend release is invalid" >&2; exit 1; }
  rm -f "${NEXT_LINK}"
  ln -s "${previous}" "${NEXT_LINK}"
  mv -Tf "${NEXT_LINK}" "${FRONTEND_DIR}/current"
  echo "Frontend rolled back to: ${previous}"
  exit 0
fi

if [[ "${MODE}" != "stage" && "${MODE}" != "build-and-activate" ]]; then
  echo "Unknown FRONTEND_RELEASE_MODE: ${MODE}" >&2
  exit 1
fi

# Preserve the legacy dist build as the first rollback target before the
# current symlink is switched for the first time.
if [[ ! -e "${FRONTEND_DIR}/current" ]]; then
  [[ -s "${FRONTEND_DIR}/dist/index.html" ]] || { echo "No current frontend build is available for rollback" >&2; exit 1; }
  ln -s "${FRONTEND_DIR}/dist" "${FRONTEND_DIR}/current"
fi

GIT_SHA="$(git -C "${PROJECT_DIR}" rev-parse --short=12 HEAD)"
RELEASE_ID="${GIT_SHA}-$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE_DIR="${RELEASES_DIR}/${RELEASE_ID}"
mkdir -p "${RELEASES_DIR}"
chown root:root "${RELEASES_DIR}"
chmod 0755 "${RELEASES_DIR}"
rm -rf "${RELEASE_DIR}"

cd "${FRONTEND_DIR}"
if [[ -n "${FRONTEND_BUILD_DIR}" ]]; then
  [[ -s "${FRONTEND_BUILD_DIR}/dist/index.html" && -d "${FRONTEND_BUILD_DIR}/dist/assets" ]] \
    || { echo "The prebuilt frontend release is invalid" >&2; exit 1; }
  mkdir -p "${RELEASE_DIR}"
  cp -a "${FRONTEND_BUILD_DIR}/dist/." "${RELEASE_DIR}/"
else
  npm run typecheck
  npm run build -- --outDir "${RELEASE_DIR}"
fi
test -s "${RELEASE_DIR}/index.html"
test -d "${RELEASE_DIR}/assets"
stamp_release "${RELEASE_DIR}/index.html" "${GIT_SHA}"
grep -Fq "name=\"intitrade-release\" content=\"${GIT_SHA}\"" "${RELEASE_DIR}/index.html"

# Keep the previous release's hashed assets so already-open browser tabs can
# finish loading lazy chunks after the atomic switch.
if [[ -d "${FRONTEND_DIR}/current/assets" ]]; then
  cp -a -n "${FRONTEND_DIR}/current/assets/." "${RELEASE_DIR}/assets/"
elif [[ -d "${FRONTEND_DIR}/dist/assets" ]]; then
  cp -a -n "${FRONTEND_DIR}/dist/assets/." "${RELEASE_DIR}/assets/"
fi

# Releases are served as immutable files and cannot be changed by the
# isolated build account after the atomic switch.
chown -R root:root "${RELEASE_DIR}"
chmod -R a+rX,u-w,go-w "${RELEASE_DIR}"

printf '%s\n' "${RELEASE_DIR}" > "${PENDING_FILE}"
echo "Frontend release staged: ${RELEASE_DIR}"

if [[ "${MODE}" == "build-and-activate" ]]; then
  activate_release "${RELEASE_DIR}"
fi

# Retain a bounded number of complete releases, excluding the staged/current
# targets. Compatibility assets are copied forward before this cleanup.
current_target="$(readlink -f "${FRONTEND_DIR}/current" 2>/dev/null || true)"
mapfile -t old_releases < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n "+$((KEEP_RELEASES + 1))" | cut -d' ' -f2-)
for old_release in "${old_releases[@]}"; do
  if [[ "${old_release}" != "${RELEASE_DIR}" && "${old_release}" != "${current_target}" ]]; then
    rm -rf -- "${old_release}"
  fi
done
