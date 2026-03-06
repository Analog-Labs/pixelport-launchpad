import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';
import { authenticateRequest, errorResponse } from '../../lib/auth';
import { getIntegrationDef } from '../../lib/integrations/registry';
import { generateState } from '../../lib/integrations/oauth-state';

/**
 * GET /api/connections/[service]/install
 *
 * Generic OAuth initiation endpoint. Looks up the service in the registry,
 * builds the authorization URL, and redirects the user.
 *
 * For PKCE-enabled services (e.g., X/Twitter), generates a code verifier
 * and includes the challenge in the redirect.
 *
 * Query params:
 *   token — Supabase JWT (browser redirects can't carry headers)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const service = req.query.service as string;
    if (!service) {
      return res.status(400).json({ error: 'Missing service parameter' });
    }

    const def = getIntegrationDef(service);
    if (!def || !def.oauth) {
      return res.status(404).json({ error: `Unknown or non-OAuth integration: ${service}` });
    }

    if (def.comingSoon) {
      return res.status(400).json({ error: `Integration '${def.displayName}' is coming soon` });
    }

    // Accept JWT from query param (browser redirects can't carry Authorization headers)
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (queryToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }

    const { tenant } = await authenticateRequest(req);

    const clientId = process.env[def.oauth.clientIdEnvVar];
    if (!clientId) {
      console.error(`Missing env var: ${def.oauth.clientIdEnvVar}`);
      return res.status(500).json({ error: `${def.displayName} integration not configured` });
    }

    // Build redirect URI
    const redirectUri = buildRedirectUri(req, service);

    // PKCE support (X/Twitter requires it) — generate before state so verifier is signed
    let codeVerifier: string | undefined;
    if (def.oauth.pkce) {
      codeVerifier = randomBytes(32).toString('base64url');
    }

    // Generate HMAC-signed state (includes codeVerifier in HMAC if present)
    const state = generateState(tenant.id, codeVerifier);

    // Build authorization URL
    const authUrl = new URL(def.oauth.authorizationUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    // Set scopes
    if (def.oauth.scopes.length > 0) {
      authUrl.searchParams.set('scope', def.oauth.scopes.join(' '));
    }

    // Add service-specific params
    if (def.oauth.additionalParams) {
      for (const [key, value] of Object.entries(def.oauth.additionalParams)) {
        authUrl.searchParams.set(key, value);
      }
    }

    // PKCE: add code challenge
    if (codeVerifier) {
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    return res.redirect(302, authUrl.toString());
  } catch (error) {
    return errorResponse(res, error);
  }
}

function buildRedirectUri(req: VercelRequest, service: string): string {
  const host = req.headers.host;
  if (!host) {
    throw new Error('Missing host header for redirect URI');
  }
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const scheme = proto || 'https';
  return `${scheme}://${host}/api/connections/${service}/callback`;
}
