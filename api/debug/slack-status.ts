import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/debug/slack-status
 *
 * Diagnostic endpoint to check tenant + Slack connection status.
 * NOT for production use — remove after debugging.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const secret = typeof req.query.secret === 'string' ? req.query.secret : '';
  const expected = process.env.API_KEY_ENCRYPTION_KEY;
  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const url = process.env.SUPABASE_PROJECT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing Supabase config' });
  }

  const supabase = createClient(url, key);

  // Get all tenants
  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .select('id, slug, name, status, droplet_ip, droplet_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (tErr) {
    return res.status(500).json({ error: 'Failed to query tenants', detail: tErr.message });
  }

  // Get all slack connections
  const { data: slackConns, error: sErr } = await supabase
    .from('slack_connections')
    .select('tenant_id, team_id, team_name, is_active, connected_at, updated_at')
    .order('connected_at', { ascending: false })
    .limit(5);

  if (sErr) {
    return res.status(500).json({ error: 'Failed to query slack_connections', detail: sErr.message });
  }

  return res.status(200).json({
    diagnostic: 'Slack Integration Status',
    timestamp: new Date().toISOString(),
    tenants: tenants?.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      droplet_ip: t.droplet_ip,
      droplet_id: t.droplet_id,
      created_at: t.created_at,
    })),
    slack_connections: slackConns?.map((s) => ({
      tenant_id: s.tenant_id,
      team_id: s.team_id,
      team_name: s.team_name,
      is_active: s.is_active,
      connected_at: s.connected_at,
      updated_at: s.updated_at,
    })),
  });
}
