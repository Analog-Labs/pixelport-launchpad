import { Inngest } from 'inngest';
import { createClient } from '@supabase/supabase-js';
import { getIntegrationDef } from '../../lib/integrations/registry';
import { decrypt } from '../../lib/integrations/crypto';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EventData = { tenantId?: string; service?: string };

function getSupabaseClient() {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Generic integration activation function.
 *
 * Triggered when a user connects a new integration (OAuth callback or API key).
 * Steps:
 *   1. Load integration row from DB
 *   2. Validate the token works by calling a lightweight API endpoint
 *   3. Fetch account info (name, ID) if not already populated
 *   4. Mark integration as active
 *
 * Most integrations don't need droplet-side activation (unlike Slack).
 * The agent accesses them through the Vercel proxy endpoint.
 */
export const activateIntegration = inngest.createFunction(
  {
    id: 'activate-integration',
    name: 'Activate integration for tenant',
    retries: 2,
  },
  { event: 'pixelport/integration.connected' },
  async ({ event, step }) => {
    const { tenantId, service } = (event.data || {}) as EventData;
    if (!tenantId || !service) {
      throw new Error('Missing tenantId or service in event payload');
    }

    const def = getIntegrationDef(service);
    if (!def) {
      throw new Error(`Unknown service: ${service}`);
    }

    const supabase = getSupabaseClient();

    // Step 1: Load the integration row
    const integration = await step.run('load-integration', async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('service', service)
        .single();

      if (error || !data) {
        throw new Error(`Integration row not found for tenant ${tenantId}, service ${service}`);
      }
      return data;
    });

    // Step 2: Validate the token works (service-specific lightweight call)
    const validationResult = await step.run('validate-token', async () => {
      if (!integration.access_token) {
        return { valid: false, error: 'No access token' };
      }

      const accessToken = decrypt(integration.access_token);
      return await validateToken(service, accessToken, integration.metadata as Record<string, unknown>);
    });

    if (!validationResult.valid) {
      // Mark as error but don't throw — the user can retry
      await step.run('mark-error', async () => {
        await supabase
          .from('integrations')
          .update({
            status: 'error',
            error_message: validationResult.error || 'Token validation failed',
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('service', service);
      });

      return { success: false, service, error: validationResult.error };
    }

    // Step 3: Update account info + mark active
    await step.run('mark-active', async () => {
      const update: Record<string, unknown> = {
        is_active: true,
        status: 'active',
        error_message: null,
        updated_at: new Date().toISOString(),
      };

      // If validation returned account info, save it
      if (validationResult.accountId) {
        update.account_id = validationResult.accountId;
      }
      if (validationResult.accountName) {
        update.account_name = validationResult.accountName;
      }

      await supabase
        .from('integrations')
        .update(update)
        .eq('tenant_id', tenantId)
        .eq('service', service);
    });

    return { success: true, service, tenantId };
  }
);

/**
 * Validate a token by making a lightweight API call to the service.
 * Also fetches account info (name/ID) when possible.
 */
async function validateToken(
  service: string,
  accessToken: string,
  metadata: Record<string, unknown>
): Promise<{ valid: boolean; error?: string; accountId?: string; accountName?: string }> {
  try {
    switch (service) {
      case 'x': {
        // GET /2/users/me — lightweight user lookup
        const resp = await fetch('https://api.twitter.com/2/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) return { valid: false, error: `X API returned ${resp.status}` };
        const data = await resp.json() as { data?: { id?: string; username?: string; name?: string } };
        return {
          valid: true,
          accountId: data.data?.id,
          accountName: data.data?.username ? `@${data.data.username}` : data.data?.name,
        };
      }

      case 'linkedin': {
        // GET /v2/me — lightweight profile check
        const resp = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) return { valid: false, error: `LinkedIn API returned ${resp.status}` };
        const data = await resp.json() as { sub?: string; name?: string };
        return { valid: true, accountId: data.sub, accountName: data.name };
      }

      case 'posthog': {
        // Verify PostHog token by fetching the specific project
        const projectId = metadata?.project_id;
        const host = (metadata?.posthog_host as string)?.replace(/\/+$/, '') || 'https://us.posthog.com';
        if (!projectId) {
          return { valid: false, error: 'PostHog project_id is required. Reconnect and provide your Project ID.' };
        }
        const resp = await fetch(`${host}/api/projects/${projectId}/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) return { valid: false, error: `PostHog API returned ${resp.status}` };
        const data = await resp.json() as { id?: number; name?: string };
        return {
          valid: true,
          accountId: data.id ? String(data.id) : String(projectId),
          accountName: data.name || `Project ${projectId}`,
        };
      }

      case 'ga4': {
        // Verify GA4 token by listing accessible properties
        const resp = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) return { valid: false, error: `Google Analytics API returned ${resp.status}` };
        const data = await resp.json() as {
          accountSummaries?: Array<{
            account?: string;
            displayName?: string;
            propertySummaries?: Array<{ property?: string; displayName?: string }>;
          }>;
        };
        const firstAccount = data.accountSummaries?.[0];
        const firstProperty = firstAccount?.propertySummaries?.[0];
        return {
          valid: true,
          accountId: firstProperty?.property,
          accountName: firstProperty?.displayName || firstAccount?.displayName,
        };
      }

      default:
        // For unknown services, assume valid (no validation endpoint defined yet)
        return { valid: true };
    }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Validation failed' };
  }
}
