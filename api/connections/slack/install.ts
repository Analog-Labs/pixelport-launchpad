import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import { authenticateRequest, errorResponse } from '../../lib/auth';
import { REQUIRED_SLACK_BOT_SCOPES } from '../../lib/slack-connection';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const STATE_SECRET = process.env.SLACK_STATE_SECRET || process.env.API_KEY_ENCRYPTION_KEY;

const BOT_SCOPES = REQUIRED_SLACK_BOT_SCOPES.join(',');

function getForwardedProto(req: VercelRequest): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const rawProto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const normalized = rawProto?.split(',')[0]?.trim();
  return normalized || 'https';
}

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

  const scheme = getForwardedProto(req);
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const { clientId, stateSecret } = getConfig();

    const state = generateState(tenant.id, stateSecret);
    const redirectUri = buildRedirectUri(req);

    const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackAuthUrl.searchParams.set('client_id', clientId);
    slackAuthUrl.searchParams.set('scope', BOT_SCOPES);
    slackAuthUrl.searchParams.set('redirect_uri', redirectUri);
    slackAuthUrl.searchParams.set('state', state);

    return res.status(200).json({ authorize_url: slackAuthUrl.toString() });
  } catch (error) {
    return errorResponse(res, error);
  }
}
