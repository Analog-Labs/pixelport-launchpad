import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const { gateway_token, ...safeTenant } = tenant;
    return res.status(200).json(safeTenant);
  } catch (error) {
    return errorResponse(res, error);
  }
}
