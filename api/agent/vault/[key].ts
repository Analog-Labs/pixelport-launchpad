import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

const VALID_KEYS = ['company_profile', 'brand_voice', 'icp', 'competitors', 'products'];

/**
 * PUT /api/agent/vault/:key — Chief updates a vault section
 * Auth: X-Agent-Key header (per-tenant agent API key)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);
    const sectionKey = req.query.key as string;

    if (!sectionKey || !VALID_KEYS.includes(sectionKey)) {
      return res.status(400).json({ error: `Invalid section key. Must be one of: ${VALID_KEYS.join(', ')}` });
    }

    const { content, status } = req.body || {};

    const updateData: Record<string, unknown> = {
      last_updated_by: 'agent',
    };

    if (content !== undefined) updateData.content = content;
    if (status) {
      const validStatuses = ['pending', 'populating', 'ready'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      updateData.status = status;
    }

    const { data, error } = await supabase
      .from('vault_sections')
      .update(updateData)
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
