import type { VercelRequest, VercelResponse } from '@vercel/node';

// TEST F: Import from project root lib/ (outside api/)
import { inngest } from '../../lib/inngest-client';

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  return res.status(200).json({
    test: 'F - inngest client from root lib/',
    timestamp: new Date().toISOString(),
    inngest_type: typeof inngest,
  });
}
