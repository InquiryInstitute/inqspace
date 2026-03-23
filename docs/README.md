# iNQspace marketing site (Astro)

Deploy this **`docs/`** app per course or fork: **GitHub Actions** sets **`PUBLIC_IDE_DEMO_REPO`** to **`github.repository`** (or a repo **variable** override), so GitHub links and the embedded IDE demo default to **that** repo. Add each site’s origin to **`INQSPACE_CORS_ORIGINS`** on the API when the fork uses a different hostname.

## Embedded IDE: API base URL (dynamic default)

The home page and `/demo/vscode-iframe` call **`POST {apiBase}/ide/launch`**.

**By default** the browser uses a **runtime** API base: **`{current origin}/api`** — no GitHub secret or JSON required. That matches setups where routing is **dynamic** (same hostname, `/api` forwarded to your Express/Cloud Run API).

**Overrides** (only if the API is on another host):

| Override | When |
| :-- | :-- |
| **`PUBLIC_INQSPACE_API_URL`** (Actions secret or `docs/.env`) | Bake a full URL at build time, e.g. `https://your-service.run.app/api` |
| **`docs/public/inqspace-api.json`** → `"apiBase": "https://…"` | Runtime override without rebuilding (omit or leave `apiBase` empty to keep the same-origin default) |

### GitHub Actions secret (cross-origin API only)

Repo → **Settings** → **Secrets and variables** → **Actions** → **`PUBLIC_INQSPACE_API_URL`**

```bash
printf '%s' 'https://your-service-xxxxx.run.app/api' | gh secret set PUBLIC_INQSPACE_API_URL --repo InquiryInstitute/inqspace
```

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
