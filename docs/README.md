# iNQspace marketing site (Astro)

Deploy this **`docs/`** app per course or fork: **GitHub Actions** sets **`PUBLIC_IDE_DEMO_REPO`** to **`github.repository`** (or a repo **variable** override), so GitHub links and the embedded IDE demo default to **that** repo. Add each site’s origin to **`INQSPACE_CORS_ORIGINS`** on the API when the fork uses a different hostname.

## Embedded IDE: API base URL

The home page and `/demo/vscode-iframe` call **`POST {apiBase}/ide/launch`**.

**GitHub Pages** only serves static files — it does **not** run your API at `/api`. Point the site at a host that implements **`POST …/ide/launch`** (CORS + proxy to the provisioner):

| Source | When |
| :-- | :-- |
| **`PUBLIC_INQSPACE_API_URL`** (Actions secret or `docs/.env`) | e.g. **`infra/ide-launch-http/`** (Cloud Function Gen2 — same role as `src/api/ideLaunchRouter.ts`), or Express / Cloud Run |
| **`docs/public/inqspace-api.json`** → `"apiBase": "https://…"` | Same URL, committed — no secret |

**Local dev:** without those, the client uses **`http://localhost:4321/api`** only on **localhost** (or set `PUBLIC_INQSPACE_API_URL`).

**Same hostname + reverse proxy:** if your CDN forwards `/api` to the API on the **same** origin as the site, set build env **`PUBLIC_INQSPACE_SAME_ORIGIN_API=true`**.

### GitHub Actions secret (typical for Pages)

Repo → **Settings** → **Secrets and variables** → **Actions** → **`PUBLIC_INQSPACE_API_URL`**

```bash
# Example: Cloud Function base URL (no path) — client calls {url}/ide/launch
printf '%s' 'https://REGION-PROJECT.cloudfunctions.net/inqspace-ide-launch' | gh secret set PUBLIC_INQSPACE_API_URL --repo InquiryInstitute/inqspace
```

See **[infra/ide-launch-http/README.md](../infra/ide-launch-http/README.md)** to deploy that function.

### Local dev

Copy **`docs/env.example`** to **`docs/.env`**. Leave `PUBLIC_INQSPACE_API_URL` unset to hit **`http://localhost:4321/api`** if your API is proxied there, or set an absolute URL.

---

## Astro commands

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Dev server at `http://localhost:4321`       |
| `npm run build`   | Production build to `./dist/`               |
| `npm run preview` | Preview the production build                |

See [Astro docs](https://docs.astro.build) for more.
