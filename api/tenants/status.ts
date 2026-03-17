import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { reconcileBootstrapState } from '../lib/bootstrap-state';
import {
  THIN_BRIDGE_CONTRACT_VERSION,
  isTaskStepUnlocked,
  type TenantStatusBridgePayload,
} from '../lib/thin-bridge-contract';

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
    const tenantStatus = typeof tenant.status === 'string' ? tenant.status : null;
    const bootstrapStatus = bootstrap.effectiveState.status ?? null;

    const payload: TenantStatusBridgePayload = {
      contract_version: THIN_BRIDGE_CONTRACT_VERSION,
      status: tenantStatus,
      bootstrap_status: bootstrapStatus,
      task_step_unlocked: isTaskStepUnlocked(tenantStatus),
      has_agent_output: bootstrap.progress.hasAgentOutput,
      has_droplet: !!tenant.droplet_id,
      has_gateway: !!tenant.gateway_token,
      has_litellm: !!tenant.litellm_team_id,
      has_agentmail: !!tenant.agentmail_inbox,
      trial_ends_at: tenant.trial_ends_at ?? null,
      plan: tenant.plan ?? null,
    };

    return res.status(200).json(payload);
  } catch (error) {
    return errorResponse(res, error);
  }
}
