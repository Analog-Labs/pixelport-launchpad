import type { VercelRequest, VercelResponse } from '@vercel/node';

// TEST C: Direct inngest package import (not our local file)
import { Inngest } from 'inngest';

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const client = new Inngest({ id: 'test' });
  return res.status(200).json({
    test: 'C - direct inngest package',
    timestamp: new Date().toISOString(),
    inngest_type: typeof client,
  });
}
