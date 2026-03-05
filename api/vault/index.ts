import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * GET /api/vault — List all vault sections for tenant
 * Auth: Bearer token (Supabase Auth)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

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
