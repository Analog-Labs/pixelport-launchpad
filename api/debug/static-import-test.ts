import type { VercelRequest, VercelResponse } from '@vercel/node';

// TEST B: Just inngest (no supabase)
import { inngest } from '../inngest/client';

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  return res.status(200).json({
    test: 'B - inngest only',
    timestamp: new Date().toISOString(),
    inngest_type: typeof inngest,
  });
}
