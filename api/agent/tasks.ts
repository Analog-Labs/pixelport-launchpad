import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * POST /api/agent/tasks — Chief creates a new task
 * Auth: X-Agent-Key header (per-tenant agent API key)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);

    const {
      agent_role,
      agent_model,
      task_type,
      task_description,
      task_input,
      task_output,
      status,
      requires_approval,
      scheduled_for,
      platform,
    } = req.body || {};

    if (!agent_role || !task_type || !task_description) {
      return res.status(400).json({ error: 'Missing required fields: agent_role, task_type, task_description' });
    }

    const validTypes = ['draft_content', 'research', 'competitor_analysis', 'strategy', 'report'];
    if (!validTypes.includes(task_type)) {
      return res.status(400).json({ error: `Invalid task_type. Must be one of: ${validTypes.join(', ')}` });
    }

    const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const insertData: Record<string, unknown> = {
      tenant_id: tenant.id,
      agent_role,
      task_type,
      task_description,
      status: status || 'pending',
    };

    if (agent_model) insertData.agent_model = agent_model;
    if (task_input) insertData.task_input = task_input;
    if (task_output) insertData.task_output = task_output;
    if (requires_approval !== undefined) {
      insertData.requires_approval = requires_approval;
      if (requires_approval) {
        insertData.approval_status = 'pending';
      }
    }
    if (scheduled_for) insertData.scheduled_for = scheduled_for;
    if (platform) insertData.platform = platform;

    const { data, error } = await supabase
      .from('agent_tasks')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create task:', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }

    return res.status(201).json(data);
  } catch (error) {
    return errorResponse(res, error);
  }
}
