/**
 * Minimal xAPI LRS HTTP client (POST statements).
 */

export interface LrsPostResult {
  ok: boolean;
  status: number;
  body?: string;
}

export class LrsClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async postStatement(
    lrsBaseUrl: string,
    authHeader: string,
    statement: object
  ): Promise<LrsPostResult> {
    const base = lrsBaseUrl.replace(/\/$/, '');
    const url = `${base}/statements`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'X-Experience-API-Version': '1.0.3',
      },
      body: JSON.stringify(statement),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  }
}

export function basicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}
