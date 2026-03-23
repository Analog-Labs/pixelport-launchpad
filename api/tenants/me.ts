import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { getBootstrapState, reconcileBootstrapState } from '../lib/bootstrap-state';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    let reconciledOnboardingData = tenant.onboarding_data;
    let reconciledUpdatedAt = tenant.updated_at;

    try {
      const bootstrap = await reconcileBootstrapState({
        tenantId: tenant.id,
        fallbackOnboardingData: tenant.onboarding_data,
      });
      reconciledOnboardingData = bootstrap.snapshot.onboardingData;
      reconciledUpdatedAt = bootstrap.snapshot.updatedAt;
    } catch (error) {
      const fallbackState = getBootstrapState(tenant.onboarding_data);
      console.warn(
        `[tenants/me] reconcileBootstrapState failed for tenant ${tenant.id}; ` +
          `using fallback bootstrap state=${fallbackState.status}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const { gateway_token, agent_api_key, paperclip_api_key, ...safeTenant } = tenant;
    return res.status(200).json({
      ...safeTenant,
      onboarding_data: reconciledOnboardingData,
      updated_at: reconciledUpdatedAt,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
