import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/debug/env-check
 *
 * Lists which required environment variables are set (without revealing values).
 * NOT for production use — remove after debugging.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const secret = typeof req.query.secret === 'string' ? req.query.secret : '';
  const expected = process.env.API_KEY_ENCRYPTION_KEY;
  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const vars = [
    'SUPABASE_PROJECT_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LITELLM_URL',
    'LITELLM_MASTER_KEY',
    'DO_API_TOKEN',
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
    'API_KEY_ENCRYPTION_KEY',
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET',
    'SLACK_SIGNING_SECRET',
    'SSH_PRIVATE_KEY',
    'SLACK_APP_TOKEN',
    'AGENTMAIL_API_KEY',
    'GEMINI_API_KEY',
    'OPENCLAW_IMAGE',
    'OPENCLAW_RUNTIME_IMAGE',
    'PROVISIONING_DROPLET_IMAGE',
    'PROVISIONING_DROPLET_SIZE',
    'PROVISIONING_DROPLET_REGION',
    'PIXELPORT_DROPLET_IMAGE',
    'DO_GOLDEN_IMAGE_ID',
    'PIXELPORT_DROPLET_SIZE',
    'PIXELPORT_DROPLET_REGION',
    'PAPERCLIP_RUNTIME_URL',
    'PAPERCLIP_HANDOFF_SECRET',
    'PAPERCLIP_HANDOFF_TTL_SECONDS',
  ];

  const results = vars.map((name) => {
    const val = process.env[name];
    return {
      name,
      status: val ? 'SET' : 'MISSING',
    };
  });

  const missing = results.filter((r) => r.status === 'MISSING').map((r) => r.name);

  return res.status(200).json({
    diagnostic: 'Environment Variable Check',
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV,
    total_vars: results.length,
    set_count: results.filter((r) => r.status === 'SET').length,
    missing_count: missing.length,
    missing,
    details: results,
  });
}
