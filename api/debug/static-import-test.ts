import type { VercelRequest, VercelResponse } from '@vercel/node';

// TEST E: Inline client creation with eventKey (same params as our client file)
import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  return res.status(200).json({
    test: 'E - inline client with eventKey',
    timestamp: new Date().toISOString(),
    inngest_type: typeof inngest,
    eventKey_set: !!process.env.INNGEST_EVENT_KEY,
  });
}
