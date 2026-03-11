import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getIntegrationDef } from '../lib/integrations/registry';
import { deriveSlackConnection } from '../lib/slack-connection';

/**
 * GET /api/agent/capabilities
 *
 * Returns the list of connected integrations and their available actions
 * for the authenticated tenant. The Chief agent calls this on startup
 * to discover what it can do.
 *
 * Auth: X-Agent-Key header
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);

    // Load all integrations for this tenant
    const { data: rows, error } = await supabase
      .from('integrations')
      .select('service, account_name, is_active, status')
      .eq('tenant_id', tenant.id);

    if (error) {
      console.error('Failed to load integrations for capabilities', error);
      return res.status(500).json({ error: 'Failed to load integrations' });
    }

    // Also check Slack (legacy table)
    const { data: slackConn } = await supabase
      .from('slack_connections')
      .select('team_id, team_name, is_active, connected_at, scopes, installer_user_id')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    const integrations: Array<{
      service: string;
      status: string;
      account_name: string | null;
      capabilities: string[];
    }> = [];

    // Add Slack if connected
    const slack = deriveSlackConnection(slackConn);

    if (slack.active) {
      integrations.push({
        service: 'slack',
        status: 'active',
        account_name: slack.team_name ?? null,
        capabilities: ['send_message', 'read_channels'],
      });
    }

    // Add email if configured
    if (tenant.agentmail_inbox) {
      integrations.push({
        service: 'email',
        status: 'active',
        account_name: tenant.agentmail_inbox,
        capabilities: ['send_email', 'read_email'],
      });
    }

    // Add generic integrations
    if (rows) {
      for (const row of rows) {
        if (row.status !== 'active' && row.status !== 'connected') continue;

        const def = getIntegrationDef(row.service);
        integrations.push({
          service: row.service,
          status: row.status,
          account_name: row.account_name,
          capabilities: def?.capabilities || [],
        });
      }
    }

    // Build available_actions map for easy agent reference
    const availableActions: Record<string, string> = {};
    for (const integration of integrations) {
      for (const cap of integration.capabilities) {
        availableActions[`${integration.service}.${cap}`] = cap
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }

    return res.status(200).json({
      integrations,
      available_actions: availableActions,
      proxy_endpoint: 'POST /api/agent/integrations',
      proxy_usage: {
        method: 'POST',
        headers: { 'X-Agent-Key': '$PIXELPORT_API_KEY', 'Content-Type': 'application/json' },
        body: '{ "service": "<service>", "action": "<action>", "params": { ... } }',
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
