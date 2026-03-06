import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Inngest } from 'inngest';
import { supabase } from '../../lib/supabase';
import { getIntegrationDef } from '../../lib/integrations/registry';
import { verifyState } from '../../lib/integrations/oauth-state';
import { encrypt } from '../../lib/integrations/crypto';

const DEFAULT_APP_URL = 'https://pixelport-launchpad.vercel.app';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/**
 * GET /api/connections/[service]/callback
 *
 * Generic OAuth callback endpoint. Exchanges the authorization code for tokens,
 * encrypts and stores them, and fires an Inngest event.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const service = req.query.service as string;
  const appUrl = dashboardUrl(req);

  if (!service) {
    return res.redirect(302, `${appUrl}/dashboard/connections?error=missing_service`);
  }

  const def = getIntegrationDef(service);
  if (!def || !def.oauth) {
    return res.redirect(302, `${appUrl}/dashboard/connections?error=unknown_service`);
  }

  const code = readQueryValue(req.query.code);
  const stateParam = readQueryValue(req.query.state);
  const oauthError = readQueryValue(req.query.error);

  if (oauthError) {
    return res.redirect(302, `${appUrl}/dashboard/connections?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !stateParam) {
    return res.redirect(302, `${appUrl}/dashboard/connections?error=missing_params`);
  }

  // Verify state (HMAC-signed, includes PKCE code verifier in signature if present)
  const verified = verifyState(stateParam);
  if (!verified) {
    return res.redirect(302, `${appUrl}/dashboard/connections?error=invalid_state`);
  }
  const { tenantId, codeVerifier } = verified;

  const clientId = process.env[def.oauth.clientIdEnvVar];
  const clientSecret = process.env[def.oauth.clientSecretEnvVar];
  if (!clientId || !clientSecret) {
    console.error(`Missing OAuth credentials for ${service}`);
    return res.redirect(302, `${appUrl}/dashboard/connections?error=missing_credentials`);
  }

  try {
    const redirectUri = buildRedirectUri(req, service);

    // Exchange authorization code for tokens
    const tokenBody: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    };

    // PKCE: include code_verifier if present
    if (codeVerifier) {
      tokenBody.code_verifier = codeVerifier;
    }

    // X/Twitter requires Basic auth header instead of client_secret in body
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (def.oauth.pkce) {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
      // X doesn't want client_id/secret in body when using Basic auth
      delete tokenBody.client_id;
      delete tokenBody.client_secret;
    }

    const tokenResponse = await fetch(def.oauth.tokenUrl, {
      method: 'POST',
      headers,
      body: new URLSearchParams(tokenBody),
    });

    const tokenData = (await tokenResponse.json()) as Record<string, unknown>;

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error(`${service} OAuth token exchange failed`, {
        status: tokenResponse.status,
        error: tokenData.error || tokenData.error_description,
      });
      return res.redirect(302, `${appUrl}/dashboard/connections?error=${service}_oauth_failed`);
    }

    // Encrypt tokens
    const encryptedAccessToken = encrypt(tokenData.access_token as string);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encrypt(tokenData.refresh_token as string)
      : null;

    // Calculate token expiry
    let tokenExpiresAt: string | null = null;
    if (tokenData.expires_in && typeof tokenData.expires_in === 'number') {
      tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    }

    // Extract account info (varies by service)
    const accountInfo = extractAccountInfo(service, tokenData);

    // Upsert into integrations table
    const { error: upsertError } = await supabase.from('integrations').upsert(
      {
        tenant_id: tenantId,
        service,
        auth_type: 'oauth',
        account_id: accountInfo.accountId,
        account_name: accountInfo.accountName,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokenExpiresAt,
        scopes: def.oauth.scopes,
        metadata: accountInfo.metadata,
        is_active: false,
        status: 'connected',
        error_message: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,service' }
    );

    if (upsertError) {
      console.error(`Failed to save ${service} connection`, upsertError);
      return res.redirect(302, `${appUrl}/dashboard/connections?error=save_failed`);
    }

    // Fire Inngest event
    try {
      await inngest.send({
        name: 'pixelport/integration.connected',
        data: { tenantId, service },
      });
    } catch (inngestError) {
      console.error(`Failed to emit integration.connected event for ${service}`, inngestError);
    }

    return res.redirect(302, `${appUrl}/dashboard/connections?${service}=connected`);
  } catch (error) {
    console.error(`${service} callback failed`, error);
    return res.redirect(302, `${appUrl}/dashboard/connections?error=internal_error`);
  }
}

function readQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function dashboardUrl(req: VercelRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const host = req.headers.host;
  if (!host) return DEFAULT_APP_URL;
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const scheme = proto || 'https';
  return `${scheme}://${host}`;
}

function buildRedirectUri(req: VercelRequest, service: string): string {
  const host = req.headers.host;
  if (!host) throw new Error('Missing host header');
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const scheme = proto || 'https';
  return `${scheme}://${host}/api/connections/${service}/callback`;
}

/**
 * Extract account info from the token exchange response.
 * Each service returns different data alongside the tokens.
 */
function extractAccountInfo(
  service: string,
  tokenData: Record<string, unknown>
): { accountId: string | null; accountName: string | null; metadata: Record<string, unknown> } {
  const metadata: Record<string, unknown> = {};

  // Some services include user/org info in the token response
  // For others, we'll need a separate API call (done in activate-integration)
  switch (service) {
    case 'posthog': {
      // PostHog OAuth includes organization + project info
      const org = tokenData.organization as Record<string, unknown> | undefined;
      const project = tokenData.project as Record<string, unknown> | undefined;
      if (project?.id) metadata.project_id = project.id;
      if (org?.id) metadata.organization_id = org.id;
      return {
        accountId: project?.id ? String(project.id) : null,
        accountName: (project?.name as string) || (org?.name as string) || null,
        metadata,
      };
    }
    default:
      // For X, LinkedIn, GA4 etc. — account info fetched in activate-integration
      return { accountId: null, accountName: null, metadata };
  }
}
