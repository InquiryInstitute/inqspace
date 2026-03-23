# code-server on Google Cloud Run

Canonical **GCP + code-server** assets for Inquiry Institute projects (browser VS Code, iframe from course sites, optional **aipa-lecturer-bridge** WebSocket channel).

Build context is always the **repository root** (`inqspace`), so Docker paths stay `infra/code-server-gcp/…` and `extensions/aipa-lecturer-bridge/`.

## Local deploy (recommended first time)

Uses your user credentials (`gcloud auth login`); no JSON service account file required.

```bash
gcloud auth login   # if needed
cp infra/code-server-gcp/env.example infra/code-server-gcp/.env
# Set GCP_PROJECT (from: gcloud projects list), PASSWORD, TRUSTED_ORIGINS
# Example TRUSTED_ORIGINS: aipa.castalia.institute,inquiryinstitute.github.io

./scripts/deploy-cloud-run-local.sh
```

Optional arguments (default clone target for the **Cloud Run service** — image build still uses this repo):

```bash
./scripts/deploy-cloud-run-local.sh InquiryInstitute/AIPA main
```

Or set in `.env`: `DEPLOY_REPO=InquiryInstitute/AIPA` and `DEPLOY_REF=main`.

## Manual deploy from this folder

```bash
cd infra/code-server-gcp
set -a && source .env && set +a
./deploy-for-repo.sh InquiryInstitute/inqspace main
```

## GitHub Actions

Workflow: **Deploy code-server (Cloud Run)** (manual). Repository secrets:

| Secret | Purpose |
|--------|---------|
| `GCP_SA_KEY` | Service account JSON (Cloud Build, Artifact Registry, Cloud Run) |
| `GCP_PROJECT` | GCP project id |
| `CODE_SERVER_PASSWORD` | code-server login password |
| `CODE_SERVER_TRUSTED_ORIGINS` | Comma-separated hostnames only (parent pages that iframe the IDE) |
| `GCP_REGION` | Optional, default `us-central1` |
| `GIT_REPO_URL`, `GIT_REF`, `GIT_TOKEN` | Optional overrides for private clone |

## Embeds and security

- Set **`TRUSTED_ORIGINS`** to every site hostname that iframes code-server (no `https://`).
- **`PASSWORD`**: rotate per term; prefer hashed password in production (code-server docs).

## HTTP provisioner (arbitrary repo)

To **create or update** a Cloud Run service for any `owner/repo` via HTTPS (same image, runtime clone), deploy the Cloud Functions Gen2 app in **`infra/provisioner/`** (see that folder’s `README.md`). It wraps the same env vars as `deploy-for-repo.sh` / `deploy-cloud-run.sh` and uses the Cloud Run v2 API—**it does not rebuild the image**; point `DEFAULT_IMAGE` at your Artifact Registry tag.

## Related repos

- Course content (Jupyter Book, slides) may live in **AIPA** or other repos; each can have its own Cloud Run **service** (`aipa-cs-<owner>-<repo>`) reusing the **same** container image built from **this** repo.
