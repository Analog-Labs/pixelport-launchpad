import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../../lib/auth';
import { getIntegrationDef } from '../../lib/integrations/registry';
import { encrypt } from '../../lib/integrations/crypto';
import { supabase } from '../../lib/supabase';
import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/**
 * POST /api/connections/api-key/connect
 *
 * Store an API key integration. The user provides their API key
 * (and optional extra fields like host/project_id), which are
 * encrypted and stored in the integrations table.
 *
 * Body: { service: string, api_key: string, extra?: Record<string, string> }
 *
 * The integration is stored as status='connected', is_active=false.
 * The Inngest activate-integration function validates the key and
 * marks it active if valid.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    const { service, api_key, extra } = req.body || {};

    if (!service || typeof service !== 'string') {
      return res.status(400).json({ error: 'Missing required field: service' });
    }

    if (!api_key || typeof api_key !== 'string') {
      return res.status(400).json({ error: 'Missing required field: api_key' });
    }

    const def = getIntegrationDef(service);
    if (!def) {
      return res.status(404).json({ error: `Unknown integration: ${service}` });
    }

    if (def.authType !== 'api_key') {
      return res.status(400).json({ error: `Integration '${service}' uses OAuth, not API key` });
    }

    if (def.comingSoon) {
      return res.status(400).json({ error: `Integration '${def.displayName}' is coming soon` });
    }

    // Validate required extra fields
    const extraData = (extra && typeof extra === 'object') ? extra as Record<string, string> : {};
    if (def.apiKeyConfig?.extraFields) {
      for (const field of def.apiKeyConfig.extraFields) {
        if (field.required && !extraData[field.name]) {
          return res.status(400).json({ error: `Missing required field: ${field.label}` });
        }
      }
    }

    // Encrypt the API key
    const encryptedKey = encrypt(api_key);

    // Store the last 4 characters as a hint for display
    const keyHint = api_key.slice(-4);

    // Build metadata from extra fields
    const metadata: Record<string, unknown> = { key_hint: keyHint };
    for (const [key, value] of Object.entries(extraData)) {
      if (value) metadata[key] = value;
    }

    // Store as connected (not active) — activation validates the key
    const { error: upsertError } = await supabase.from('integrations').upsert(
      {
        tenant_id: tenant.id,
        service,
        auth_type: 'api_key',
        account_name: `Key ending in ...${keyHint}`,
        access_token: encryptedKey,
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        metadata,
        is_active: false,
        status: 'connected',
        error_message: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,service' }
    );

    if (upsertError) {
      console.error(`Failed to save ${service} API key`, upsertError);
      return res.status(500).json({ error: 'Failed to save API key' });
    }

    // Fire Inngest event — activation will validate the key and mark active
    try {
      await inngest.send({
        name: 'pixelport/integration.connected',
        data: { tenantId: tenant.id, service },
      });
    } catch (inngestError) {
      console.error(`Failed to emit integration.connected event for ${service}`, inngestError);
    }

    return res.status(200).json({ connected: true, service, displayName: def.displayName });
  } catch (error) {
    return errorResponse(res, error);
  }
}
