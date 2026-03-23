# iNQspace provisioner (Cloud Functions Gen2)

HTTP function that **creates or updates** a **Cloud Run** service running the **same code-server image** as `infra/code-server-gcp/`, parameterized for an **arbitrary GitHub repo** (`GIT_REPO_URL`, `GIT_REF`, optional `GIT_TOKEN`). This matches `deploy-for-repo.sh` + `deploy-cloud-run.sh`, but callable over HTTPS for automation (iNQspace control plane, scripts, CI).

**Browsers** should not call this function directly (it requires `X-Provisioner-Secret`). Use the public **`infra/ide-launch-http/`** Cloud Function or **`src/api/ideLaunchRouter`** in the Node app to proxy requests.

**It does not rebuild the Docker image.** Build and push the image with Cloud Build / CI first; set `DEFAULT_IMAGE` to that Artifact Registry URL.

## Environment (function)

| Variable | Required | Description |
|----------|----------|-------------|
| `PROVISIONER_SECRET` | yes | Shared secret; send as `X-Provisioner-Secret` or `Authorization: Bearer …` |
| `GCP_PROJECT` | yes | GCP project id |
| `GCP_REGION` | no | Default `us-central1` |
| `DEFAULT_IMAGE` | yes | Full image ref, e.g. `us-central1-docker.pkg.dev/PROJECT/aipa/aipa-code-server:latest` |
| `CODE_SERVER_PASSWORD` | yes* | code-server password if not sent per request |
| `CODE_SERVER_TRUSTED_ORIGINS` | yes* | Comma-separated hostnames for iframe (if not sent per request) |
| `SERVICE_PREFIX` | no | Default `aipa-cs` (service id = `{prefix}-{owner}-{repo}` truncated) |

\* Per-request `password` / `trustedOrigins` in JSON overrides these.

## Deploy (example)

```bash
cd infra/provisioner
npm ci

export GCP_PROJECT="your-project"
export REGION="us-central1"
export IMAGE="${REGION}-docker.pkg.dev/${GCP_PROJECT}/aipa/aipa-code-server:latest"

gcloud functions deploy inqspace-provision-repo \
  --gen2 \
  --runtime=nodejs20 \
  --region="${REGION}" \
  --source=. \
  --entry-point=provisionRepo \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT=${GCP_PROJECT},GCP_REGION=${REGION},DEFAULT_IMAGE=${IMAGE},SERVICE_PREFIX=aipa-cs" \
  --set-secrets="PROVISIONER_SECRET=inqspace-provisioner-secret:latest,CODE_SERVER_PASSWORD=code-server-password:latest,CODE_SERVER_TRUSTED_ORIGINS=code-server-trusted-origins:latest"
```

Create secrets in Secret Manager (or use `--set-env-vars` for non-secret dev values). Grant the function’s service account **`roles/run.developer`** (or `roles/run.admin`) on the project.

## Request

`POST` JSON:

```json
{
  "owner": "InquiryInstitute",
  "repo": "AIPA",
  "ref": "main",
  "gitToken": "optional-for-private-clone",
  "password": "optional-override",
  "trustedOrigins": "optional-override"
}
```

Headers: `X-Provisioner-Secret: <PROVISIONER_SECRET>`.

## Response

```json
{
  "ok": true,
  "serviceId": "aipa-cs-inquiryinstitute-aipa",
  "serviceName": "projects/…/locations/…/services/…",
  "serviceUrl": "https://…run.app",
  "gitRepoUrl": "https://github.com/InquiryInstitute/AIPA.git",
  "ref": "main"
}
```

## Building the image

Use the existing pipeline: `infra/code-server-gcp/cloudbuild.yaml` and `gcloud builds submit` from the **inqspace** repo root, or your CI workflow. The provisioner only deploys that image with env vars.

## Local run

```bash
export PROVISIONER_SECRET=devsecret
export GCP_PROJECT=…
export DEFAULT_IMAGE=…
export CODE_SERVER_PASSWORD=…
export CODE_SERVER_TRUSTED_ORIGINS=localhost,127.0.0.1
npm start
# curl -s http://localhost:8080
```
