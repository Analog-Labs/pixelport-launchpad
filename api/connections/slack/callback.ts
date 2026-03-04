import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, createCipheriv, randomBytes } from 'crypto';
import { Inngest } from 'inngest';
import { supabase } from '../../lib/supabase';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const STATE_SECRET = process.env.SLACK_STATE_SECRET || process.env.API_KEY_ENCRYPTION_KEY;
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;
const DEFAULT_APP_URL = 'https://pixelport-launchpad.vercel.app';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

function getHexKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('API_KEY_ENCRYPTION_KEY must be a 64-char hex string');
  }

  return Buffer.from(ENCRYPTION_KEY, 'hex');
}

function getStateSecret(): string {
  if (!STATE_SECRET) {
    throw new Error('Missing SLACK_STATE_SECRET or API_KEY_ENCRYPTION_KEY');
  }

  return STATE_SECRET;
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

function dashboardUrl(req: VercelRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const host = req.headers.host;
  if (!host) {
    return DEFAULT_APP_URL;
  }

  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const scheme = proto || 'https';
  return `${scheme}://${host}`;
}

function readQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function verifyState(state: string): string | null {
  const [tenantId, timestamp, signature] = state.split('.');
  if (!tenantId || !timestamp || !signature) return null;

  let secret: string;
  try {
    secret = getStateSecret();
  } catch {
    return null;
  }

  const payload = `${tenantId}.${timestamp}`;
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .slice(0, 32);

  if (expected !== signature) return null;

  const issuedAtMs = Number.parseInt(timestamp, 36);
  if (!Number.isFinite(issuedAtMs)) return null;

  const tenMinutesMs = 10 * 60 * 1000;
  if (Date.now() - issuedAtMs > tenMinutesMs) return null;

  return tenantId;
}

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', getHexKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appUrl = dashboardUrl(req);
  const code = readQueryValue(req.query.code as string | string[] | undefined);
  const state = readQueryValue(req.query.state as string | string[] | undefined);
  const slackError = readQueryValue(req.query.error as string | string[] | undefined);

  if (slackError) {
    return res.redirect(302, `${appUrl}/dashboard/connections?error=${encodeURIComponent(slackError)}`);
  }

  if (!code || !state) {
    return res.redirect(302, `${appUrl}/dashboard/connections?error=missing_params`);
  }

  const tenantId = verifyState(state);
  if (!tenantId) {
    return res.redirect(302, `${appUrl}/dashboard/connections?error=invalid_state`);
  }

  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    console.error('Missing Slack client credentials');
    return res.redirect(302, `${appUrl}/dashboard/connections?error=missing_slack_credentials`);
  }

  try {
    const redirectUri = buildRedirectUri(req);

    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json() as {
      ok?: boolean;
      error?: string;
      access_token?: string;
      team?: { id?: string; name?: string };
      bot_user_id?: string;
      authed_user?: { id?: string };
      scope?: string;
    };

    if (!tokenResponse.ok || !tokenData.ok || !tokenData.access_token || !tokenData.team?.id) {
      console.error('Slack OAuth exchange failed', {
        status: tokenResponse.status,
        error: tokenData.error,
      });
      return res.redirect(302, `${appUrl}/dashboard/connections?error=slack_oauth_failed`);
    }

    const encryptedToken = encrypt(tokenData.access_token);

    const { error: upsertError } = await supabase
      .from('slack_connections')
      .upsert(
        {
          tenant_id: tenantId,
          team_id: tokenData.team.id,
          team_name: tokenData.team.name || null,
          bot_token: encryptedToken,
          bot_user_id: tokenData.bot_user_id || null,
          installer_user_id: tokenData.authed_user?.id || null,
          scopes: tokenData.scope ? tokenData.scope.split(',') : [],
          is_active: false,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );

    if (upsertError) {
      console.error('Failed to save Slack connection', upsertError);
      return res.redirect(302, `${appUrl}/dashboard/connections?error=save_failed`);
    }

    try {
      await inngest.send({
        name: 'pixelport/slack.connected',
        data: { tenantId },
      });
    } catch (inngestError) {
      console.error('Failed to emit slack.connected event', inngestError);
    }

    return res.redirect(302, `${appUrl}/dashboard/connections?slack=connected`);
  } catch (error) {
    console.error('Slack callback failed', error);
    return res.redirect(302, `${appUrl}/dashboard/connections?error=internal_error`);
  }
}
