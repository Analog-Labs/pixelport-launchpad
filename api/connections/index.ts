import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getPublicRegistry } from '../lib/integrations/registry';
import { deriveSlackConnection } from '../lib/slack-connection';

/**
 * GET /api/connections
 *
 * Returns integration status for the tenant + the public registry catalog.
 * The frontend renders the Connections page from this response.
 *
 * Response shape:
 * {
 *   integrations: {
 *     slack: { connected, active, team_name, ... },
 *     email: { connected, inbox },
 *     x: { connected, active, account_name, status },
 *     linkedin: { connected: false },
 *     ...
 *   },
 *   registry: [ { service, displayName, category, authType, ... }, ... ]
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    // Load Slack connection (legacy table)
    const { data: slackConn, error: slackError } = await supabase
      .from('slack_connections')
      .select('team_id, team_name, is_active, connected_at, scopes')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (slackError) {
      console.error('Failed to load slack connection', slackError);
      return res.status(500).json({ error: 'Failed to load integrations' });
    }

    // Load all generic integrations for this tenant
    const { data: integrationRows, error: intError } = await supabase
      .from('integrations')
      .select('service, auth_type, account_id, account_name, scopes, is_active, status, error_message, connected_at, last_used_at')
      .eq('tenant_id', tenant.id);

    if (intError) {
      console.error('Failed to load integrations', intError);
      return res.status(500).json({ error: 'Failed to load integrations' });
    }

    // Build integrations status map
    const integrations: Record<string, unknown> = {};

    // Slack (from legacy table)
    integrations.slack = deriveSlackConnection(slackConn);

    // Email (from tenants table)
    integrations.email = {
      connected: Boolean(tenant.agentmail_inbox),
      inbox: tenant.agentmail_inbox || null,
    };

    // Generic integrations (from integrations table)
    if (integrationRows) {
      for (const row of integrationRows) {
        integrations[row.service] = {
          connected: true,
          active: row.is_active,
          status: row.status,
          account_id: row.account_id,
          account_name: row.account_name,
          auth_type: row.auth_type,
          scopes: row.scopes || [],
          error_message: row.error_message,
          connected_at: row.connected_at,
          last_used_at: row.last_used_at,
        };
      }
    }

    return res.status(200).json({
      integrations,
      registry: getPublicRegistry(),
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
