import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

/**
 * PATCH /api/agent/tasks/:id — Chief updates a task (status, output, etc.)
 * Auth: X-Agent-Key header (per-tenant agent API key)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);
    const taskId = req.query.id as string;

    if (!taskId) {
      return res.status(400).json({ error: 'Missing task ID' });
    }

    const { status, task_output, task_input, agent_model } = req.body || {};

    const updateData: Record<string, unknown> = {};

    if (status) {
      const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      updateData.status = status;
    }

    if (task_output !== undefined) updateData.task_output = task_output;
    if (task_input !== undefined) updateData.task_input = task_input;
    if (agent_model) updateData.agent_model = agent_model;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No update fields provided' });
    }

    const { data, error } = await supabase
      .from('agent_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('tenant_id', tenant.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update task:', error);
      return res.status(500).json({ error: 'Failed to update task' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json(data);
  } catch (error) {
    return errorResponse(res, error);
  }
}
