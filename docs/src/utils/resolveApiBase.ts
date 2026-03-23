/** Normalize API base (no trailing slash). */
export function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Public iNQspace API base for POST /ide/launch.
 * 1) Build-time `PUBLIC_INQSPACE_API_URL` (use on GitHub Pages — API is never on the Pages origin)
 * 2) Runtime `/inqspace-api.json` → `{ "apiBase": "https://…" }` if non-empty
 * 3) Else same-origin `{origin}/api` only when: localhost, or `PUBLIC_INQSPACE_SAME_ORIGIN_API=true` (reverse proxy in prod)
 *
 * GitHub Pages alone does not serve POST /api — defaulting every hostname to /api caused 405 on static hosts.
 */
function shouldUseSameOriginApiFallback(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = import.meta.env.PUBLIC_INQSPACE_SAME_ORIGIN_API;
  if (flag === 'true' || flag === '1') return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export async function resolveApiBase(buildTime: string): Promise<string> {
  const fromBuild = normalizeApiBase(buildTime);
  if (fromBuild) return fromBuild;
  if (typeof window === 'undefined') return '';

  let fromJson = '';
  try {
    const base = import.meta.env.BASE_URL || '/';
    const jsonPath = `${base}inqspace-api.json`.replace(/\/+/g, '/');
    const r = await fetch(jsonPath, { cache: 'no-store' });
    if (r.ok) {
      const j = (await r.json()) as { apiBase?: unknown };
      fromJson = typeof j.apiBase === 'string' ? normalizeApiBase(j.apiBase) : '';
    }
  } catch {
    /* optional file */
  }
  if (fromJson) return fromJson;

  if (shouldUseSameOriginApiFallback()) {
    return normalizeApiBase(new URL('/api', window.location.origin).href);
  }
  return '';
}
