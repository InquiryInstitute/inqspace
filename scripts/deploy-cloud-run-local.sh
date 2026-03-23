#!/usr/bin/env bash
# Build and deploy the code-server image to Cloud Run using local gcloud credentials.
# Repo for service naming + default clone URL: first arg, or DEPLOY_REPO / DEPLOY_REF in .env.
#
#   cp infra/code-server-gcp/env.example infra/code-server-gcp/.env
#   # GCP_PROJECT, PASSWORD, TRUSTED_ORIGINS=…
#   ./scripts/deploy-cloud-run-local.sh                           # default: this repo @ main
#   ./scripts/deploy-cloud-run-local.sh InquiryInstitute/AIPA main
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "gcloud is not authenticated. Run: gcloud auth login" >&2
  exit 1
fi
ENV_FILE="${ROOT}/infra/code-server-gcp/.env"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi
: "${GCP_PROJECT:?Set GCP_PROJECT in infra/code-server-gcp/.env}"
if [[ "${GCP_PROJECT}" == "your-gcp-project-id" ]] || [[ "${GCP_PROJECT}" == REPLACE_* ]] || [[ "${GCP_PROJECT}" == *YOUR_* ]]; then
  echo "GCP_PROJECT is still a placeholder. Set your real project id (gcloud projects list)." >&2
  exit 1
fi
: "${PASSWORD:?Set PASSWORD in .env}"
if [[ "${PASSWORD}" == "change-me" ]] || [[ "${PASSWORD}" == REPLACE_* ]]; then
  echo "PASSWORD is still a placeholder in .env." >&2
  exit 1
fi
: "${TRUSTED_ORIGINS:?Set TRUSTED_ORIGINS (comma-separated hostnames, no https://)}"
export GCP_PROJECT GCP_REGION="${GCP_REGION:-us-central1}" PASSWORD TRUSTED_ORIGINS

REPO_SPEC="${1:-${DEPLOY_REPO:-}}"
REF="${2:-${DEPLOY_REF:-main}}"
if [[ -z "${REPO_SPEC}" ]]; then
  remote_url="$(git -C "${ROOT}" remote get-url origin 2>/dev/null || true)"
  if [[ "${remote_url}" =~ github.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    REPO_SPEC="${BASH_REMATCH[1]}/${BASH_REMATCH[2]%.git}"
  else
    echo "Could not infer owner/repo. Pass:  $0 owner/repo [ref]" >&2
    echo "Or set DEPLOY_REPO and DEPLOY_REF in infra/code-server-gcp/.env" >&2
    exit 1
  fi
fi

cd "${ROOT}/infra/code-server-gcp"
exec ./deploy-for-repo.sh "${REPO_SPEC}" "${REF}"
