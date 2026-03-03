import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from './lib/auth';
import { proxyToGateway } from './lib/gateway';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    if (tenant.status !== 'active') {
      return res.status(503).json({ error: 'Agent is not yet active', status: tenant.status });
    }

    const { message, agent_id } = (req.body || {}) as { message?: string; agent_id?: string };

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await proxyToGateway(tenant, '/openclaw/chat', {
      method: 'POST',
      body: {
        message,
        agent_id: agent_id || 'main',
      },
    });

    return res.status(200).json(response);
  } catch (error) {
    return errorResponse(res, error);
  }
}
