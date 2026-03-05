import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * GET /api/agent/vault — Chief reads all vault sections for its tenant
 * Auth: X-Agent-Key header (per-tenant agent API key)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);

    const { data: sections, error } = await supabase
      .from('vault_sections')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch vault sections:', error);
      return res.status(500).json({ error: 'Failed to fetch vault sections' });
    }

    return res.status(200).json(sections ?? []);
  } catch (error) {
    return errorResponse(res, error);
  }
}
