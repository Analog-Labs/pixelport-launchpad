import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * POST /api/tasks/reject — Reject a task with feedback
 * Auth: Bearer token (Supabase Auth)
 *
 * Body: { task_id: string, feedback: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant, userId } = await authenticateRequest(req);
    const { task_id, feedback } = req.body || {};

    if (!task_id) {
      return res.status(400).json({ error: 'Missing required field: task_id' });
    }

    // Verify the task exists and belongs to tenant
    const { data: existing, error: fetchError } = await supabase
      .from('agent_tasks')
      .select('id, requires_approval, approval_status')
      .eq('id', task_id)
      .eq('tenant_id', tenant.id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!existing.requires_approval) {
      return res.status(400).json({ error: 'This task does not require approval' });
    }

    const { data, error } = await supabase
      .from('agent_tasks')
      .update({
        approval_status: 'rejected',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_feedback: feedback || null,
      })
      .eq('id', task_id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to reject task:', error);
      return res.status(500).json({ error: 'Failed to reject task' });
    }

    return res.status(200).json(data);
  } catch (error) {
    return errorResponse(res, error);
  }
}
