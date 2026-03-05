import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * GET /api/tasks/:id — Get a single task
 * Auth: Bearer token (Supabase Auth)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const taskId = req.query.id as string;

    if (!taskId) {
      return res.status(400).json({ error: 'Missing task ID' });
    }

    const { data, error } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('tenant_id', tenant.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json(data);
  } catch (error) {
    return errorResponse(res, error);
  }
}
