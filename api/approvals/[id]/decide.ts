import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant, userId } = await authenticateRequest(req);
    const approvalId = req.query.id as string;
    const { decision, feedback } = (req.body || {}) as { decision?: string; feedback?: string };

    if (!approvalId) {
      return res.status(400).json({ error: 'Missing approval id' });
    }

    if (!decision || !['approved', 'rejected', 'revision_requested'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be: approved, rejected, or revision_requested' });
    }

    const { data: approval, error: approvalError } = await supabase
      .from('approvals')
      .update({
        status: decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        feedback: feedback || null,
      })
      .eq('id', approvalId)
      .eq('tenant_id', tenant.id)
      .select('id, content_item_id')
      .single();

    if (approvalError || !approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    const contentStatusMap: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      revision_requested: 'draft',
    };

    await supabase
      .from('content_items')
      .update({ status: contentStatusMap[decision], feedback: feedback || null })
      .eq('id', approval.content_item_id)
      .eq('tenant_id', tenant.id);

    return res.status(200).json({ success: true, approval_id: approval.id, decision });
  } catch (error) {
    return errorResponse(res, error);
  }
}
