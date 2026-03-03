import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  try {
    const { tenant } = await authenticateRequest(req);
    const agentId = req.query.id as string;

    if (!agentId) {
      return res.status(400).json({ error: 'Missing agent id' });
    }

    if (req.method === 'GET') {
      const { data: agent, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('tenant_id', tenant.id)
        .single();

      if (error || !agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      return res.status(200).json(agent);
    }

    if (req.method === 'PATCH') {
      const allowedFields = ['display_name', 'tone', 'avatar_url', 'settings'] as const;
      const updates: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (req.body?.[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { data: agent, error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', agentId)
        .eq('tenant_id', tenant.id)
        .select('*')
        .single();

      if (error || !agent) {
        return res.status(404).json({ error: 'Agent not found or update failed' });
      }

      return res.status(200).json(agent);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
