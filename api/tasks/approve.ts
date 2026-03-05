import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * POST /api/tasks/approve — Approve a task (content approval workflow)
 * Auth: Bearer token (Supabase Auth)
 *
 * Body: { task_id: string, scheduled_for?: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant, userId } = await authenticateRequest(req);
    const { task_id, scheduled_for } = req.body || {};

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

    if (existing.approval_status === 'approved') {
      return res.status(400).json({ error: 'Task is already approved' });
    }

    const updateData: Record<string, unknown> = {
      approval_status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    };

    if (scheduled_for) {
      updateData.scheduled_for = scheduled_for;
    }

    const { data, error } = await supabase
      .from('agent_tasks')
      .update(updateData)
      .eq('id', task_id)
      .eq('tenant_id', tenant.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to approve task:', error);
      return res.status(500).json({ error: 'Failed to approve task' });
    }

    return res.status(200).json(data);
  } catch (error) {
    return errorResponse(res, error);
  }
}
