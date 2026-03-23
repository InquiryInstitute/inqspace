# iNQspace marketing site (Astro)

Static site for **https://inqspace.castalia.institute** (GitHub Pages).

## Embedded IDE: API base URL

The home page and `/demo/vscode-iframe` call **`POST {apiBase}/ide/launch`** on your deployed **iNQspace Express API** (not code-server directly). You must provide `apiBase` in **one** of these ways:

### Option A — GitHub Actions secret (recommended for CI)

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: **`PUBLIC_INQSPACE_API_URL`**
3. Value: your API root with **`/api`** if the app mounts the router there, e.g. `https://your-service-xxxxx.run.app/api`
4. Push any change under **`docs/**`** (or run **Actions → Deploy to GitHub Pages → Run workflow**) to rebuild.

From the CLI (replace the URL):

```bash
printf '%s' 'https://your-service-xxxxx.run.app/api' | gh secret set PUBLIC_INQSPACE_API_URL --repo InquiryInstitute/inqspace
```

### Option B — `public/inqspace-api.json` (no secret)

1. Edit **`docs/public/inqspace-api.json`** and set `"apiBase"` to the same URL as above (no trailing slash).
2. Commit and push; the **Deploy to GitHub Pages** workflow runs on `docs/**` changes.

The browser loads this file at **`/inqspace-api.json`** and uses it when the build-time env var is empty.

### Local dev

Copy **`docs/env.example`** to **`docs/.env`** and set `PUBLIC_INQSPACE_API_URL` (see comments there).

---

## Astro commands

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Dev server at `http://localhost:4321`       |
| `npm run build`   | Production build to `./dist/`               |
| `npm run preview` | Preview the production build                |

See [Astro docs](https://docs.astro.build) for more.
