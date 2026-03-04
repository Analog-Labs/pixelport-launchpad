import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import { authenticateRequest, errorResponse } from '../../lib/auth';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const STATE_SECRET = process.env.SLACK_STATE_SECRET || process.env.API_KEY_ENCRYPTION_KEY;

const BOT_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'channels:read',
  'chat:write',
  'im:history',
  'im:read',
  'im:write',
  'users:read',
].join(',');

function getConfig(): { clientId: string; stateSecret: string } {
  if (!SLACK_CLIENT_ID) {
    throw new Error('Missing SLACK_CLIENT_ID');
  }

  if (!STATE_SECRET) {
    throw new Error('Missing SLACK_STATE_SECRET or API_KEY_ENCRYPTION_KEY');
  }

  return {
    clientId: SLACK_CLIENT_ID,
    stateSecret: STATE_SECRET,
  };
}

function buildRedirectUri(req: VercelRequest): string {
  if (process.env.SLACK_REDIRECT_URI) {
    return process.env.SLACK_REDIRECT_URI;
  }

  const host = req.headers.host;
  if (!host) {
    throw new Error('Missing host header for redirect URI');
  }

  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const scheme = proto || 'https';
  return `${scheme}://${host}/api/connections/slack/callback`;
}

function generateState(tenantId: string, stateSecret: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${tenantId}.${timestamp}`;
  const signature = createHmac('sha256', stateSecret)
    .update(payload)
    .digest('hex')
    .slice(0, 32);
  return `${payload}.${signature}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Browser redirects (window.location.href) cannot carry Authorization headers.
    // Accept the Supabase JWT as a query parameter for OAuth initiation.
    // The token is short-lived and only consumed by our server — never forwarded to Slack.
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (queryToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }

    const { tenant } = await authenticateRequest(req);
    const { clientId, stateSecret } = getConfig();

    const state = generateState(tenant.id, stateSecret);
    const redirectUri = buildRedirectUri(req);

    const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackAuthUrl.searchParams.set('client_id', clientId);
    slackAuthUrl.searchParams.set('scope', BOT_SCOPES);
    slackAuthUrl.searchParams.set('redirect_uri', redirectUri);
    slackAuthUrl.searchParams.set('state', state);

    return res.redirect(302, slackAuthUrl.toString());
  } catch (error) {
    return errorResponse(res, error);
  }
}
