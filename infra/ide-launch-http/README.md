# iNQspace IDE launch API (Cloud Functions Gen2)

**Public** HTTPS endpoint for the static site: **`POST /ide/launch`** with `{ owner, repo, ref }`, CORS for GitHub Pages, then proxies to the **provisioner** Cloud Function using **`INQSPACE_PROVISIONER_SECRET`** (never exposed to the browser).

This is the **Cloud Function** counterpart to **`src/api/ideLaunchRouter.ts`** in the Node app. Use **one** of:

- Deploy **this** function and set **`PUBLIC_INQSPACE_API_URL`** on the docs site to the function’s base URL (see below), **or**
- Run the full Express API elsewhere and point **`PUBLIC_INQSPACE_API_URL`** there.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `INQSPACE_PROVISIONER_URL` | yes | HTTPS URL of the **provisioner** (`provisionRepo`) — `POST` with JSON |
| `INQSPACE_PROVISIONER_SECRET` | yes | Same secret as provisioner `X-Provisioner-Secret` |
| `INQSPACE_CORS_ORIGINS` | no | Extra comma-separated origins (defaults include Castalia + GitHub Pages) |

Store secrets in Secret Manager or `--set-secrets` when deploying.

## Deploy from GitHub Actions

Repository **Actions → Deploy IDE launch HTTP** (workflow_dispatch). Requires secrets:

| Secret | Purpose |
|--------|---------|
| `GCP_SA_KEY` | Service account JSON |
| `GCP_PROJECT` | GCP project id |
| `INQSPACE_PROVISIONER_URL` | Provisioner function HTTPS URL |
| `INQSPACE_PROVISIONER_SECRET` | Same secret the provisioner expects |

On success, the workflow sets repository variable **`PUBLIC_INQSPACE_API_URL`** to the function’s HTTPS base URL. Re-run **Deploy to GitHub Pages** (or push `docs/**`) so the site picks it up.

## Deploy (example)

```bash
cd infra/ide-launch-http
npm ci

export GCP_PROJECT="your-project"
export REGION="us-central1"
export PROVISIONER_URL="https://${REGION}-${GCP_PROJECT}.cloudfunctions.net/inqspace-provision-repo"
# Or your provisioner’s real URL

gcloud functions deploy inqspace-ide-launch \
  --gen2 \
  --runtime=nodejs20 \
  --region="${REGION}" \
  --source=. \
  --entry-point=ideLaunch \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT=${GCP_PROJECT}" \
  --set-secrets="INQSPACE_PROVISIONER_URL=...,INQSPACE_PROVISIONER_SECRET=..."
```

After deploy, note the **function URL** (often `https://REGION-PROJECT.cloudfunctions.net/inqspace-ide-launch` or a `run.app` URL for Gen2).

## GitHub Pages

Set repository secret **`PUBLIC_INQSPACE_API_URL`** to the **API base** (no trailing slash), i.e. the origin that serves **`POST …/ide/launch`**:

```text
https://REGION-PROJECT.cloudfunctions.net/inqspace-ide-launch
```

The Astro site calls **`{PUBLIC_INQSPACE_API_URL}/ide/launch`**.

## Local run

```bash
export INQSPACE_PROVISIONER_URL=https://your-provisioner-url
export INQSPACE_PROVISIONER_SECRET=devsecret
npm start
# curl -X POST http://localhost:8080/ide/launch -H 'Content-Type: application/json' -d '{"owner":"o","repo":"r"}'
```
