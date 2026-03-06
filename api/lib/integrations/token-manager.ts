import { supabase } from '../supabase';
import { encrypt, decrypt } from './crypto';
import { getIntegrationDef } from './registry';

export interface ValidToken {
  accessToken: string;
  accountId: string | null;
  accountName: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Get a valid (non-expired) access token for a tenant's integration.
 *
 * If the token is expired, attempts a refresh using the stored refresh_token.
 * If the refresh fails, sets the integration status to 'expired' and throws.
 * Updates last_used_at on every successful call.
 */
export async function getValidToken(tenantId: string, service: string): Promise<ValidToken> {
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('service', service)
    .single();

  if (error || !integration) {
    throw new Error(`Integration '${service}' not connected for this tenant`);
  }

  if (integration.status === 'revoked' || integration.status === 'error') {
    throw new Error(`Integration '${service}' is ${integration.status}: ${integration.error_message || 'reconnect required'}`);
  }

  if (!integration.access_token) {
    throw new Error(`Integration '${service}' has no stored credentials`);
  }

  let accessToken = decrypt(integration.access_token);

  // Check if token is expired (with 5-minute grace window)
  if (integration.token_expires_at && integration.auth_type === 'oauth') {
    const expiresAt = new Date(integration.token_expires_at).getTime();
    const fiveMinutesMs = 5 * 60 * 1000;

    if (Date.now() > expiresAt - fiveMinutesMs) {
      // Token is expired or about to expire — attempt refresh
      if (!integration.refresh_token) {
        await markExpired(tenantId, service, 'No refresh token available');
        throw new Error(`Integration '${service}' token expired and no refresh token available. Reconnect required.`);
      }

      try {
        accessToken = await refreshToken(tenantId, service, integration.refresh_token);
      } catch (refreshErr) {
        await markExpired(tenantId, service, refreshErr instanceof Error ? refreshErr.message : 'Refresh failed');
        throw new Error(`Integration '${service}' token expired and refresh failed. Reconnect required.`);
      }
    }
  }

  // Update last_used_at (fire and forget)
  supabase
    .from('integrations')
    .update({ last_used_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('service', service)
    .then(() => {});

  return {
    accessToken,
    accountId: integration.account_id,
    accountName: integration.account_name,
    metadata: (integration.metadata as Record<string, unknown>) || {},
  };
}

/**
 * Refresh an OAuth token using the stored refresh_token.
 * Updates the integration row with new tokens.
 * Returns the new access token (decrypted).
 */
async function refreshToken(tenantId: string, service: string, encryptedRefreshToken: string): Promise<string> {
  const def = getIntegrationDef(service);
  if (!def?.oauth) {
    throw new Error(`No OAuth config for service '${service}'`);
  }

  const refreshTokenValue = decrypt(encryptedRefreshToken);
  const clientId = process.env[def.oauth.clientIdEnvVar];
  const clientSecret = process.env[def.oauth.clientSecretEnvVar];

  if (!clientId || !clientSecret) {
    throw new Error(`Missing OAuth credentials for ${service}`);
  }

  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
    client_id: clientId,
    client_secret: clientSecret,
  };

  const response = await fetch(def.oauth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  const tokenData = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokenData.access_token) {
    throw new Error('Token refresh response missing access_token');
  }

  // Build update payload
  const update: Record<string, unknown> = {
    access_token: encrypt(tokenData.access_token),
    status: 'active',
    error_message: null,
    updated_at: new Date().toISOString(),
  };

  // Some services (X/Twitter) issue a new refresh token on each refresh
  if (tokenData.refresh_token) {
    update.refresh_token = encrypt(tokenData.refresh_token);
  }

  if (tokenData.expires_in) {
    update.token_expires_at = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  }

  const { error } = await supabase
    .from('integrations')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('service', service);

  if (error) {
    console.error('Failed to update refreshed tokens:', error);
  }

  return tokenData.access_token;
}

/**
 * Mark an integration as expired.
 */
async function markExpired(tenantId: string, service: string, reason: string): Promise<void> {
  await supabase
    .from('integrations')
    .update({
      status: 'expired',
      is_active: false,
      error_message: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('service', service);
}
