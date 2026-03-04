import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Inngest } from 'inngest';

/**
 * POST /api/debug/retry-activate-slack?tenantId=...
 *
 * Re-fires the pixelport/slack.connected event to retry the activate-slack workflow.
 * NOT for production use — remove after debugging.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenantId query param' });
  }

  const inngest = new Inngest({
    id: 'pixelport',
    eventKey: process.env.INNGEST_EVENT_KEY,
  });

  try {
    const result = await inngest.send({
      name: 'pixelport/slack.connected',
      data: { tenantId },
    });

    return res.status(200).json({
      ok: true,
      message: 'Event sent successfully. Check Inngest dashboard for function run.',
      tenantId,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
