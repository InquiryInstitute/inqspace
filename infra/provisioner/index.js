'use strict';

const { ServicesClient } = require('@google-cloud/run');

/**
 * Match infra/code-server-gcp/deploy-for-repo.sh service naming.
 * @param {string} owner
 * @param {string} repo
 * @param {string} prefix
 */
function computeServiceName(owner, repo, prefix) {
  const ownerLc = owner.toLowerCase();
  const nameLc = repo.toLowerCase();
  const slug = `${ownerLc}-${nameLc}`;
  let raw = `${prefix}-${slug}`;
  if (raw.length > 63) {
    raw = raw.slice(0, 63);
  }
  return raw.replace(/-+$/, '');
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

function json(res, status, body) {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(body));
}

/**
 * HTTP Cloud Function (Gen2): deploy or update a Cloud Run code-server for an arbitrary public GitHub repo
 * using the prebuilt image (same as deploy-for-repo.sh). The container clones GIT_REPO_URL at startup.
 *
 * @param {import('@google-cloud/functions-framework').Request} req
 * @param {import('@google-cloud/functions-framework').Response} res
 */
async function provisionRepo(req, res) {
  try {
    if (req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        service: 'inqspace-provisioner',
        usage:
          'POST JSON { owner, repo, ref?, password?, trustedOrigins?, gitToken? } with header X-Provisioner-Secret',
      });
    }

    if (req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const secret = requireEnv('PROVISIONER_SECRET');
    const got = req.get('x-provisioner-secret') || req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (got !== secret) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const owner = typeof body.owner === 'string' ? body.owner.trim() : '';
    const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
    const ref = typeof body.ref === 'string' && body.ref.trim() ? body.ref.trim() : 'main';

    if (!owner || !repo || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
      return json(res, 400, { error: 'Invalid owner or repo (expected GitHub owner/repo segments)' });
    }

    const projectId = requireEnv('GCP_PROJECT');
    const region = process.env.GCP_REGION?.trim() || 'us-central1';
    const servicePrefix = process.env.SERVICE_PREFIX?.trim() || 'aipa-cs';
    const defaultImage = requireEnv('DEFAULT_IMAGE');

    const password =
      typeof body.password === 'string' && body.password ? body.password : requireEnv('CODE_SERVER_PASSWORD');
    const trustedOrigins =
      typeof body.trustedOrigins === 'string' && body.trustedOrigins.trim()
        ? body.trustedOrigins.trim()
        : requireEnv('CODE_SERVER_TRUSTED_ORIGINS');

    const gitRepoUrl = `https://github.com/${owner}/${repo}.git`;
    const gitToken = typeof body.gitToken === 'string' ? body.gitToken.trim() : '';

    const serviceId = computeServiceName(owner, repo, servicePrefix);

    const env = [
      { name: 'PASSWORD', value: password },
      { name: 'TRUSTED_ORIGINS', value: trustedOrigins },
      { name: 'CODE_SERVER_WORKSPACE', value: '/home/coder/workspace' },
      { name: 'GIT_REPO_URL', value: gitRepoUrl },
      { name: 'GIT_REF', value: ref },
    ];
    if (gitToken) {
      env.push({ name: 'GIT_TOKEN', value: gitToken });
    }

    const service = {
      ingress: 'INGRESS_TRAFFIC_ALL',
      template: {
        timeout: { seconds: 3600 },
        sessionAffinity: true,
        scaling: {
          minInstanceCount: 0,
          maxInstanceCount: 1,
        },
        containers: [
          {
            image: defaultImage,
            ports: [{ containerPort: 8080 }],
            resources: {
              limits: { cpu: '1', memory: '2Gi' },
            },
            env,
          },
        ],
      },
    };

    const client = new ServicesClient();
    const serviceName = client.servicePath(projectId, region, serviceId);

    const [op] = await client.updateService({
      name: serviceName,
      service: { ...service, name: serviceName },
      updateMask: { paths: ['template', 'ingress'] },
      allowMissing: true,
    });

    const [serviceResult] = await op.promise();
    const url = serviceResult?.uri || null;

    return json(res, 200, {
      ok: true,
      serviceId,
      serviceName,
      serviceUrl: url,
      gitRepoUrl,
      ref,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    return json(res, 500, { error: msg });
  }
}

module.exports = { provisionRepo };
