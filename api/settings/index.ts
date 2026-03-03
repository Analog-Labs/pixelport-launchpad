import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  try {
    const { tenant } = await authenticateRequest(req);

    if (req.method === 'GET') {
      return res.status(200).json({
        settings: tenant.settings,
        plan: tenant.plan,
        trial_ends_at: tenant.trial_ends_at,
        agentmail_inbox: tenant.agentmail_inbox,
      });
    }

    if (req.method === 'PATCH') {
      const incomingSettings = (req.body?.settings ?? {}) as Record<string, unknown>;
      const currentSettings = (tenant.settings ?? {}) as Record<string, unknown>;
      const newSettings = { ...currentSettings, ...incomingSettings };

      const { data, error } = await supabase
        .from('tenants')
        .update({ settings: newSettings })
        .eq('id', tenant.id)
        .select('settings')
        .single();

      if (error) {
        return res.status(500).json({ error: 'Failed to update settings' });
      }

      return res.status(200).json({ settings: data?.settings ?? newSettings });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
