import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }

    return res.status(200).json(agents ?? []);
  } catch (error) {
    return errorResponse(res, error);
  }
}
