import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * GET /api/competitors — List competitors for tenant
 * Auth: Bearer token (Supabase Auth)
 *
 * Query params:
 *   threat_level — filter by level (low, medium, high)
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
      .from('competitors')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id);

    // Filters
    const threatLevel = req.query.threat_level as string | undefined;
    if (threatLevel) {
      const validLevels = ['low', 'medium', 'high'];
      if (validLevels.includes(threatLevel)) {
        query = query.eq('threat_level', threatLevel);
      }
    }

    // Sorting
    query = query.order('created_at', { ascending: false });

    // Pagination
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch competitors:', error);
      return res.status(500).json({ error: 'Failed to fetch competitors' });
    }

    return res.status(200).json({
      competitors: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
