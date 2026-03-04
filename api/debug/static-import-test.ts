import type { VercelRequest, VercelResponse } from '@vercel/node';

// TEST D: Import from api/lib/inngest-client (NOT from api/inngest/ directory)
import { inngest } from '../lib/inngest-client';

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  return res.status(200).json({
    test: 'D - inngest client from lib/',
    timestamp: new Date().toISOString(),
    inngest_type: typeof inngest,
  });
}
