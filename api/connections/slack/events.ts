import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

function getHeaderValue(header: string | string[] | undefined): string {
  if (Array.isArray(header)) return header[0] || '';
  return header || '';
}

function toRawBody(body: unknown): string {
  if (typeof body === 'string') return body;
  if (!body) return '';
  return JSON.stringify(body);
}

function verifySlackSignature(req: VercelRequest, rawBody: string): boolean {
  if (!SLACK_SIGNING_SECRET) return false;

  const timestamp = getHeaderValue(req.headers['x-slack-request-timestamp']);
  const signature = getHeaderValue(req.headers['x-slack-signature']);

  if (!timestamp || !signature) return false;

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${createHmac('sha256', SLACK_SIGNING_SECRET).update(base).digest('hex')}`;

  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = toRawBody(req.body);

  if (!verifySlackSignature(req, rawBody)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = typeof req.body === 'string'
    ? (JSON.parse(req.body) as { type?: string; challenge?: string; event?: { type?: string }; team_id?: string })
    : (req.body as { type?: string; challenge?: string; event?: { type?: string }; team_id?: string });

  if (body.type === 'url_verification' && body.challenge) {
    return res.status(200).json({ challenge: body.challenge });
  }

  if (body.type === 'event_callback') {
    console.log('Slack event received', {
      team_id: body.team_id,
      event_type: body.event?.type,
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true });
}
