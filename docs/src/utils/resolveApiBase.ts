/** Normalize API base (no trailing slash). */
export function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Public iNQspace API base for POST /ide/launch.
 * 1) Build-time `PUBLIC_INQSPACE_API_URL` (e.g. GitHub Actions secret)
 * 2) Runtime: static `/inqspace-api.json` → `{ "apiBase": "https://…/api" }` (browser only)
 */
export async function resolveApiBase(buildTime: string): Promise<string> {
  const fromBuild = normalizeApiBase(buildTime);
  if (fromBuild) return fromBuild;
  if (typeof window === 'undefined') return '';
  try {
    const base = import.meta.env.BASE_URL || '/';
    const jsonPath = `${base}inqspace-api.json`.replace(/\/+/g, '/');
    const r = await fetch(jsonPath, { cache: 'no-store' });
    if (!r.ok) return '';
    const j = (await r.json()) as { apiBase?: unknown };
    return typeof j.apiBase === 'string' ? normalizeApiBase(j.apiBase) : '';
  } catch {
    return '';
  }
}
