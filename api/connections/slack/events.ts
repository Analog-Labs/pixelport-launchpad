import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

type SlackEventBody = {
  type?: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type?: string;
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

function getHeaderValue(header: string | string[] | undefined): string {
  if (Array.isArray(header)) return header[0] || '';
  return header || '';
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const maybeReq = req as VercelRequest & {
    rawBody?: string | Buffer;
    body?: unknown;
  };

  if (Buffer.isBuffer(maybeReq.rawBody)) return maybeReq.rawBody;
  if (typeof maybeReq.rawBody === 'string') return Buffer.from(maybeReq.rawBody, 'utf8');

  if (Buffer.isBuffer(maybeReq.body)) return maybeReq.body;
  if (typeof maybeReq.body === 'string') return Buffer.from(maybeReq.body, 'utf8');

  if (maybeReq.body && typeof maybeReq.body === 'object') {
    return Buffer.from(JSON.stringify(maybeReq.body), 'utf8');
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function verifySlackSignature(req: VercelRequest, rawBody: Buffer): boolean {
  if (!SLACK_SIGNING_SECRET) return false;

  const timestamp = getHeaderValue(req.headers['x-slack-request-timestamp']);
  const signature = getHeaderValue(req.headers['x-slack-signature']);
  if (!timestamp || !signature) return false;

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  const base = Buffer.concat([
    Buffer.from(`v0:${timestamp}:`, 'utf8'),
    rawBody,
  ]);
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

  const rawBody = await readRawBody(req);
  if (!verifySlackSignature(req, rawBody)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let body: SlackEventBody;
  try {
    body = JSON.parse(rawBody.toString('utf8')) as SlackEventBody;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

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
