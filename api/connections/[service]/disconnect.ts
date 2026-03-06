import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../../lib/auth';
import { getIntegrationDef } from '../../lib/integrations/registry';
import { supabase } from '../../lib/supabase';

/**
 * POST /api/connections/[service]/disconnect
 *
 * Disconnect an integration — deletes stored encrypted credentials.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const service = req.query.service as string;
    if (!service) {
      return res.status(400).json({ error: 'Missing service parameter' });
    }

    const def = getIntegrationDef(service);
    if (!def) {
      return res.status(404).json({ error: `Unknown integration: ${service}` });
    }

    const { tenant } = await authenticateRequest(req);

    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('service', service);

    if (error) {
      console.error(`Failed to disconnect ${service}`, error);
      return res.status(500).json({ error: 'Failed to disconnect integration' });
    }

    return res.status(200).json({ disconnected: true, service });
  } catch (error) {
    return errorResponse(res, error);
  }
}
