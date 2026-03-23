/** Normalize API base (no trailing slash). */
export function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Public iNQspace API base for POST /ide/launch.
 * 1) Build-time `PUBLIC_INQSPACE_API_URL` (optional; e.g. GitHub Actions secret when API is another host)
 * 2) Runtime `/inqspace-api.json` → `{ "apiBase": "https://…" }` if non-empty (optional override)
 * 3) Default: **dynamic** same-origin `{origin}/api` (no static URL — works when a proxy routes `/api` to the API)
 */
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

  return normalizeApiBase(new URL('/api', window.location.origin).href);
}
