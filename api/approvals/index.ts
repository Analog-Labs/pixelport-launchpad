import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    const { data: approvals, error } = await supabase
      .from('approvals')
      .select('*, content_items(title, content_type, platform, status)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch approvals' });
    }

    return res.status(200).json(approvals ?? []);
  } catch (error) {
    return errorResponse(res, error);
  }
}
