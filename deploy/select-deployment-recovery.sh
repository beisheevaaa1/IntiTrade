#!/usr/bin/env bash
set -Eeuo pipefail

previous_compatibility="${1:-}"
expected_compatibility="${2:-}"
schema_mutation_started="${3:-}"
schema_migrations_complete="${4:-}"
backend_activated="${5:-}"
maintenance_entered="${6:-0}"

for flag in "${schema_mutation_started}" "${schema_migrations_complete}" "${backend_activated}" "${maintenance_entered}"; do
  [[ "${flag}" == "0" || "${flag}" == "1" ]] || {
    echo "Recovery policy flags must be 0 or 1" >&2
    exit 64
  }
done

# A failure before any backend activation or possible schema change leaves the
# existing service untouched. Compatibility metadata may not have been loaded
# yet in this early-failure case.
if [[ "${schema_mutation_started}" == "0" && "${backend_activated}" == "0" ]]; then
  if [[ "${maintenance_entered}" == "1" ]]; then
    printf 'resume-previous\n'
  else
    printf 'unchanged\n'
  fi
  exit 0
fi

valid_compatibility='^[a-z0-9][a-z0-9._-]{2,63}$'
[[ "${previous_compatibility}" =~ ${valid_compatibility} ]] \
  && [[ "${expected_compatibility}" =~ ${valid_compatibility} ]] \
  || { echo "Recovery policy received invalid compatibility metadata" >&2; exit 64; }

if [[ "${maintenance_entered}" == "1" && "${schema_migrations_complete}" == "0" ]]; then
  printf 'maintenance\n'
elif [[ "${schema_mutation_started}" == "1" && "${previous_compatibility}" != "${expected_compatibility}" ]]; then
  if [[ "${schema_migrations_complete}" == "1" ]]; then
    printf 'roll-forward\n'
  else
    printf 'maintenance\n'
  fi
elif [[ "${backend_activated}" == "1" ]]; then
  printf 'compatible-rollback\n'
else
  printf 'unchanged\n'
fi
