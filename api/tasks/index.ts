import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * GET /api/tasks — List tasks for tenant (filterable)
 * Auth: Bearer token (Supabase Auth)
 *
 * Query params:
 *   task_type — filter by type (draft_content, research, etc.)
 *   status — filter by status (pending, running, completed, etc.)
 *   requires_approval — filter tasks needing approval (true/false)
 *   approval_status — filter by approval state (pending, approved, rejected)
 *   scheduled_for — if "true", only tasks with scheduled_for set
 *   sort — field to sort by (created_at, scheduled_for, updated_at). Default: created_at
 *   order — asc or desc. Default: desc
 *   limit — max results (1-100). Default: 50
 *   offset — pagination offset. Default: 0
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    let query = supabase
      .from('agent_tasks')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id);

    // Filters
    const taskType = req.query.task_type as string | undefined;
    if (taskType) query = query.eq('task_type', taskType);

    const status = req.query.status as string | undefined;
    if (status) query = query.eq('status', status);

    const requiresApproval = req.query.requires_approval as string | undefined;
    if (requiresApproval === 'true') query = query.eq('requires_approval', true);
    if (requiresApproval === 'false') query = query.eq('requires_approval', false);

    const approvalStatus = req.query.approval_status as string | undefined;
    if (approvalStatus) query = query.eq('approval_status', approvalStatus);

    const scheduledFor = req.query.scheduled_for as string | undefined;
    if (scheduledFor === 'true') query = query.not('scheduled_for', 'is', null);

    // Sorting
    const sortField = (req.query.sort as string) || 'created_at';
    const validSortFields = ['created_at', 'updated_at', 'scheduled_for'];
    const sortBy = validSortFields.includes(sortField) ? sortField : 'created_at';
    const order = (req.query.order as string) === 'asc' ? true : false;
    query = query.order(sortBy, { ascending: order });

    // Pagination
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    return res.status(200).json({
      tasks: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
