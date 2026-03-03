import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  try {
    const { tenant, userId } = await authenticateRequest(req);
    const contentId = req.query.id as string;

    if (!contentId) {
      return res.status(400).json({ error: 'Missing content id' });
    }

    if (req.method === 'GET') {
      const { data: item, error } = await supabase
        .from('content_items')
        .select('*, agents(display_name, avatar_url)')
        .eq('id', contentId)
        .eq('tenant_id', tenant.id)
        .single();

      if (error || !item) {
        return res.status(404).json({ error: 'Content item not found' });
      }

      return res.status(200).json(item);
    }

    if (req.method === 'PATCH') {
      const { action, ...updates } = (req.body || {}) as Record<string, unknown>;

      if (action === 'approve' || action === 'reject' || action === 'request_revision') {
        const statusMap: Record<string, string> = {
          approve: 'approved',
          reject: 'rejected',
          request_revision: 'draft',
        };

        const { data: existing, error: fetchErr } = await supabase
          .from('content_items')
          .select('revision_count')
          .eq('id', contentId)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchErr || !existing) {
          return res.status(404).json({ error: 'Content item not found' });
        }

        const shouldIncrement = action === 'request_revision';
        const nextRevision = (existing.revision_count || 0) + (shouldIncrement ? 1 : 0);

        const { error: contentError } = await supabase
          .from('content_items')
          .update({
            status: statusMap[action],
            feedback: (updates.feedback as string) || null,
            revision_count: nextRevision,
          })
          .eq('id', contentId)
          .eq('tenant_id', tenant.id);

        if (contentError) {
          return res.status(500).json({ error: 'Failed to update content' });
        }

        const { error: approvalError } = await supabase.from('approvals').insert({
          tenant_id: tenant.id,
          content_item_id: contentId,
          status: statusMap[action],
          decided_by: userId,
          decided_at: new Date().toISOString(),
          feedback: (updates.feedback as string) || null,
        });

        if (approvalError) {
          console.error('Failed to create approval record:', approvalError);
        }

        return res.status(200).json({ success: true, new_status: statusMap[action] });
      }

      const allowedFields = ['title', 'body', 'scheduled_for', 'metadata'] as const;
      const safeUpdates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          safeUpdates[field] = updates[field];
        }
      }

      const { data: item, error } = await supabase
        .from('content_items')
        .update(safeUpdates)
        .eq('id', contentId)
        .eq('tenant_id', tenant.id)
        .select('*')
        .single();

      if (error || !item) {
        return res.status(404).json({ error: 'Content item not found or update failed' });
      }

      return res.status(200).json(item);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
