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

    return res.status(200).json({
      status: tenant.status,
      bootstrap_status: bootstrap.effectiveState.status,
      has_agent_output: bootstrap.progress.hasAgentOutput,
      has_droplet: !!tenant.droplet_id,
      has_gateway: !!tenant.gateway_token,
      has_litellm: !!tenant.litellm_team_id,
      has_agentmail: !!tenant.agentmail_inbox,
      trial_ends_at: tenant.trial_ends_at,
      plan: tenant.plan,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
