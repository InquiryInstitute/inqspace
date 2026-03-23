#!/usr/bin/env bash
set -euo pipefail

REPO_SPEC="${1:?Usage: $0 owner/repo [git-ref]}"
REF="${2:-main}"

if [[ ! "${REPO_SPEC}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Expected OWNER/REPO." >&2
  exit 1
fi

OWNER_LC="$(echo "${REPO_SPEC%%/*}" | tr '[:upper:]' '[:lower:]')"
NAME_LC="$(echo "${REPO_SPEC#*/}" | tr '[:upper:]' '[:lower:]')"
SLUG="${OWNER_LC}-${NAME_LC}"
PREFIX="${SERVICE_PREFIX:-aipa-cs}"
RAW="${PREFIX}-${SLUG}"
SERVICE_NAME="${RAW:0:63}"
SERVICE_NAME="${SERVICE_NAME%-}"

export SERVICE_NAME
export GIT_REPO_URL="${GIT_REPO_URL:-https://github.com/${REPO_SPEC}.git}"
export GIT_REF="${REF}"

echo "SERVICE_NAME=${SERVICE_NAME}"
echo "GIT_REPO_URL=${GIT_REPO_URL}"
echo "GIT_REF=${GIT_REF}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "${SCRIPT_DIR}/deploy-cloud-run.sh"
