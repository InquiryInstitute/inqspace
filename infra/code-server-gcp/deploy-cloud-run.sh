#!/usr/bin/env bash
# Deploy code-server to Google Cloud Run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

: "${GCP_PROJECT:?Set GCP_PROJECT}"
: "${GCP_REGION:=us-central1}"
: "${SERVICE_NAME:?Set SERVICE_NAME}"
: "${AR_REPO:=aipa}"
: "${IMAGE_NAME:=aipa-code-server}"
: "${PASSWORD:?Set PASSWORD}"
: "${TRUSTED_ORIGINS:?Set TRUSTED_ORIGINS}"

IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${AR_REPO}/${IMAGE_NAME}:latest"

gcloud artifacts repositories describe "${AR_REPO}" --location="${GCP_REGION}" --project="${GCP_PROJECT}" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${GCP_REGION}" \
    --project="${GCP_PROJECT}" \
    --description="Inquiry Institute / inqspace containers"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  gcloud builds submit "${REPO_ROOT}" \
    --config="${SCRIPT_DIR}/cloudbuild.yaml" \
    --substitutions=_IMAGE="${IMAGE}" \
    --project="${GCP_PROJECT}"
else
  echo "SKIP_BUILD=1 — deploying existing image ${IMAGE}"
fi

ENV_FILE="$(mktemp)"
trap 'rm -f "${ENV_FILE}"' EXIT

export \
  PASSWORD \
  TRUSTED_ORIGINS \
  GIT_REPO_URL="${GIT_REPO_URL:-}" \
  GIT_REF="${GIT_REF:-}" \
  GIT_CLONE_DIR="${GIT_CLONE_DIR:-}" \
  GIT_TOKEN="${GIT_TOKEN:-}" \
  GIT_CLONE_URL="${GIT_CLONE_URL:-}"

python3 - "$ENV_FILE" <<'PY'
import json, os, sys

path = sys.argv[1]
rows = {
    "PASSWORD": os.environ["PASSWORD"],
    "TRUSTED_ORIGINS": os.environ["TRUSTED_ORIGINS"],
    "CODE_SERVER_WORKSPACE": "/home/coder/workspace",
}
for key in ("GIT_REPO_URL", "GIT_REF", "GIT_CLONE_DIR", "GIT_TOKEN", "GIT_CLONE_URL"):
    val = os.environ.get(key, "").strip()
    if val:
        rows[key] = val

with open(path, "w", encoding="utf-8") as f:
    for k, v in rows.items():
        f.write(f"{k}: {json.dumps(v)}\n")
PY

gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --region="${GCP_REGION}" \
  --project="${GCP_PROJECT}" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=1 \
  --timeout=3600 \
  --session-affinity \
  --env-vars-file="${ENV_FILE}"

echo "Service URL:"
gcloud run services describe "${SERVICE_NAME}" --region="${GCP_REGION}" --project="${GCP_PROJECT}" --format='value(status.url)'
