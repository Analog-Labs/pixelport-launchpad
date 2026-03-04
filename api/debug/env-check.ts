import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/debug/env-check
 *
 * Lists which required environment variables are set (without revealing values).
 * NOT for production use — remove after debugging.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const vars = [
    'SUPABASE_PROJECT_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LITELLM_URL',
    'LITELLM_MASTER_KEY',
    'DO_API_TOKEN',
    'INNGEST_EVENT_KEY',
    'API_KEY_ENCRYPTION_KEY',
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET',
    'SLACK_SIGNING_SECRET',
    'AGENTMAIL_API_KEY',
    'OPENCLAW_IMAGE',
  ];

  const results = vars.map((name) => {
    const val = process.env[name];
    return {
      name,
      set: !!val,
      length: val ? val.length : 0,
      prefix: val ? val.substring(0, 4) + '...' : '(not set)',
    };
  });

  const missing = results.filter((r) => !r.set).map((r) => r.name);

  return res.status(200).json({
    diagnostic: 'Environment Variable Check',
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV,
    total_vars: results.length,
    set_count: results.filter((r) => r.set).length,
    missing_count: missing.length,
    missing,
    details: results,
  });
}
