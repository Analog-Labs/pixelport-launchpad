import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    const { data: slackConn, error: slackError } = await supabase
      .from('slack_connections')
      .select('team_id, team_name, is_active, connected_at, scopes')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (slackError) {
      console.error('Failed to load slack connection', slackError);
      return res.status(500).json({ error: 'Failed to load integrations' });
    }

    return res.status(200).json({
      integrations: {
        slack: slackConn
          ? {
              connected: true,
              active: slackConn.is_active,
              team_id: slackConn.team_id,
              team_name: slackConn.team_name,
              connected_at: slackConn.connected_at,
              scopes: slackConn.scopes || [],
            }
          : {
              connected: false,
              active: false,
            },
        email: {
          connected: Boolean(tenant.agentmail_inbox),
          inbox: tenant.agentmail_inbox || null,
        },
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
