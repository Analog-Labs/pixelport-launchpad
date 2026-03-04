import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/debug/mark-slack-active?tenantId=...
 * TEMPORARY — remove after debugging.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });

  const url = process.env.SUPABASE_PROJECT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Missing config' });

  const supabase = createClient(url, key);
  const { error } = await supabase
    .from('slack_connections')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, message: 'Slack marked as active' });
}
