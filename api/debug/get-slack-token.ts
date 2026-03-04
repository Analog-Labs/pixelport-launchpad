import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';

/**
 * POST /api/debug/get-slack-token?tenantId=...
 *
 * Returns decrypted bot token for manual config injection.
 * TEMPORARY — remove after debugging.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });

  const url = process.env.SUPABASE_PROJECT_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encKey = process.env.API_KEY_ENCRYPTION_KEY;

  if (!url || !serviceKey || !encKey || encKey.length !== 64) {
    return res.status(500).json({ error: 'Missing config' });
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from('slack_connections')
    .select('bot_token')
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const [ivHex, encHex] = data.bot_token.split(':');
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encKey, 'hex'), Buffer.from(ivHex, 'hex'));
    const token = decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
    return res.status(200).json({ token });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
