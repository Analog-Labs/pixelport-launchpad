import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

const VALID_KEYS = ['company_profile', 'brand_voice', 'icp', 'competitors', 'products'];

/**
 * PUT /api/vault/:key — User edits a vault section from the dashboard
 * Auth: Bearer token (Supabase Auth)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const sectionKey = req.query.key as string;

    if (!sectionKey || !VALID_KEYS.includes(sectionKey)) {
      return res.status(400).json({ error: `Invalid section key. Must be one of: ${VALID_KEYS.join(', ')}` });
    }

    const { content } = req.body || {};

    if (content === undefined) {
      return res.status(400).json({ error: 'Missing required field: content' });
    }

    const { data, error } = await supabase
      .from('vault_sections')
      .update({
        content,
        status: 'ready',
        last_updated_by: 'user',
      })
      .eq('tenant_id', tenant.id)
      .eq('section_key', sectionKey)
      .select()
      .single();

    if (error) {
      console.error('Failed to update vault section:', error);
      return res.status(500).json({ error: 'Failed to update vault section' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Vault section not found' });
    }

    return res.status(200).json(data);
  } catch (error) {
    return errorResponse(res, error);
  }
}
