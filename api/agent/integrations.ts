import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';
import { getIntegrationDef } from '../lib/integrations/registry';
import { getValidToken } from '../lib/integrations/token-manager';

/**
 * POST /api/agent/integrations
 *
 * Agent proxy endpoint — the Chief agent sends a service + action + params,
 * and this endpoint calls the third-party API using stored OAuth/API tokens.
 *
 * Auth: X-Agent-Key header
 *
 * Body: {
 *   service: "posthog",
 *   action: "query_insights",
 *   params: { query: "SELECT count() FROM events WHERE event = '$pageview'" }
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);

    const { service, action, params = {} } = req.body || {};

    if (!service || typeof service !== 'string') {
      return res.status(400).json({ error: 'Missing required field: service' });
    }

    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'Missing required field: action' });
    }

    const def = getIntegrationDef(service);
    if (!def) {
      return res.status(404).json({ error: `Unknown integration: ${service}` });
    }

    // Validate the action is a known capability
    if (!def.capabilities.includes(action)) {
      return res.status(400).json({
        error: `Unknown action '${action}' for ${service}`,
        available_actions: def.capabilities,
      });
    }

    // Get valid (non-expired) token
    const credentials = await getValidToken(tenant.id, service);

    // Load and call the service adapter
    let adapterModule: { handleAction: (action: string, params: Record<string, unknown>, credentials: { accessToken: string; accountId: string | null; metadata: Record<string, unknown> }) => Promise<unknown> };

    try {
      // Dynamic import of the adapter
      adapterModule = await import(`../lib/integrations/adapters/${service}`);
    } catch {
      return res.status(501).json({
        error: `Adapter not implemented for ${service}. Integration framework is ready, adapter coming soon.`,
      });
    }

    if (typeof adapterModule.handleAction !== 'function') {
      return res.status(501).json({ error: `Adapter for ${service} is missing handleAction export` });
    }

    const result = await adapterModule.handleAction(action, params as Record<string, unknown>, {
      accessToken: credentials.accessToken,
      accountId: credentials.accountId,
      metadata: credentials.metadata,
    });

    return res.status(200).json({ service, action, result });
  } catch (error) {
    return errorResponse(res, error);
  }
}
