/**
 * POST /api/ide/launch — provision code-server for a GitHub repo (proxies to Cloud Functions provisioner).
 * Used by static sites (GitHub Pages): browser only needs PUBLIC_INQSPACE_API_URL, not the Cloud Run iframe URL.
 */

import { Router, Request, Response, NextFunction } from 'express';

function allowedOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  if (!origin) return '*';
  const list = (process.env.INQSPACE_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    'https://inqspace.castalia.institute',
    'https://inquiryinstitute.github.io',
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'http://localhost:3000',
  ];
  const all = [...defaults, ...list];
  if (all.includes(origin)) return origin;
  if (list.includes('*')) return '*';
  return null;
}

function corsHeaders(req: Request, res: Response): void {
  const o = allowedOrigin(req);
  if (o) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function createIdeLaunchRouter(): Router {
  const router = Router();

  router.options('/launch', (req: Request, res: Response) => {
    corsHeaders(req, res);
    res.status(204).send();
  });

  router.post('/launch', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    corsHeaders(req, res);

    const provisionerUrl = (process.env.INQSPACE_PROVISIONER_URL || '').trim().replace(/\/$/, '');
    const secret = process.env.INQSPACE_PROVISIONER_SECRET || '';

    if (!provisionerUrl || !secret) {
      res.status(503).json({
        error: {
          code: 'NOT_CONFIGURED',
          message: 'IDE launch is not configured (INQSPACE_PROVISIONER_URL / INQSPACE_PROVISIONER_SECRET)',
        },
      });
      return;
    }

    const body = req.body as { owner?: string; repo?: string; ref?: string };
    const owner = typeof body.owner === 'string' ? body.owner.trim() : '';
    const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
    const ref = typeof body.ref === 'string' && body.ref.trim() ? body.ref.trim() : 'main';

    if (!owner || !repo || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid owner or repo' },
      });
      return;
    }

    try {
      const upstream = await fetch(provisionerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Provisioner-Secret': secret,
        },
        body: JSON.stringify({ owner, repo, ref }),
      });

      let data: { serviceUrl?: string; error?: string | { message?: string } };
      try {
        data = (await upstream.json()) as { serviceUrl?: string; error?: string | { message?: string } };
      } catch {
        res.status(502).json({
          error: { code: 'PROVISIONER_ERROR', message: 'Invalid response from provisioner' },
        });
        return;
      }

      if (!upstream.ok) {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : typeof data.error === 'object' && data.error && 'message' in data.error
              ? String((data.error as { message?: string }).message)
              : upstream.statusText;
        res.status(upstream.status).json({
          error: {
            code: 'PROVISIONER_ERROR',
            message: msg,
            details: data,
          },
        });
        return;
      }

      const serviceUrl = data.serviceUrl;
      if (!serviceUrl) {
        res.status(502).json({
          error: { code: 'BAD_RESPONSE', message: 'Provisioner did not return serviceUrl' },
        });
        return;
      }

      res.json({ serviceUrl, owner, repo, ref });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
