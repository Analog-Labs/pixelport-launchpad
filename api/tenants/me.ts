import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { reconcileBootstrapState } from '../lib/bootstrap-state';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const bootstrap = await reconcileBootstrapState({
      tenantId: tenant.id,
      fallbackOnboardingData: tenant.onboarding_data,
    });
    const { gateway_token, agent_api_key, paperclip_api_key, ...safeTenant } = tenant;
    return res.status(200).json({
      ...safeTenant,
      onboarding_data: bootstrap.snapshot.onboardingData,
      updated_at: bootstrap.snapshot.updatedAt,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
