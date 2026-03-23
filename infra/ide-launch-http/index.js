'use strict';

/**
 * Public IDE launch API — same behavior as src/api/ideLaunchRouter.ts (Express app).
 * Browser → this function (HTTPS) → provisioner (X-Provisioner-Secret) → Cloud Run code-server.
 */

const express = require('express');

const app = express();
app.use(express.json());

function allowedOrigin(req) {
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

function corsHeaders(req, res) {
  const o = allowedOrigin(req);
  if (o) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

app.options('/ide/launch', (req, res) => {
  corsHeaders(req, res);
  res.status(204).send();
});

app.post('/ide/launch', async (req, res) => {
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

  const body = req.body && typeof req.body === 'object' ? req.body : {};
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

    let data;
    try {
      data = await upstream.json();
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
          : data.error && typeof data.error === 'object' && data.error.message
            ? String(data.error.message)
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

    res.json({
      status: 'ready',
      serviceUrl,
      owner,
      repo,
      ref,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: { code: 'INTERNAL', message: e instanceof Error ? e.message : String(e) },
    });
  }
});

/** Gen2 HTTP target — functions-framework invokes this export. */
exports.ideLaunch = app;
