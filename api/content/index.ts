import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    const status = req.query.status as string | undefined;
    const contentType = req.query.type as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    let query = supabase
      .from('content_items')
      .select('*, agents(display_name, avatar_url)', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (contentType) query = query.eq('content_type', contentType);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch content' });
    }

    return res.status(200).json({ items: data ?? [], total: count ?? 0, limit, offset });
  } catch (error) {
    return errorResponse(res, error);
  }
}
