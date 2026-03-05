import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId required' });
  }
  
  try {
    await inngest.send({
      name: 'pixelport/tenant.created',
      data: { tenantId, trialMode: true },
    });
    return res.status(200).json({ action: 're-triggered', tenantId });
  } catch (err) {
    return res.status(500).json({ 
      error: 'inngest.send failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
