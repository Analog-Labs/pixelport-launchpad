import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { reconcileBootstrapState } from '../lib/bootstrap-state';
import { classifyGatewayFailure } from '../lib/openclaw-bootstrap-guard';
import { tryRecoverProvisioningTenant } from '../lib/provisioning-recovery';
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
    const recovery = await tryRecoverProvisioningTenant(tenant);
    const effectiveTenant = recovery.tenant;

    const bootstrap = await reconcileBootstrapState({
      tenantId: effectiveTenant.id,
      fallbackOnboardingData: effectiveTenant.onboarding_data,
    });
    const tenantStatus = typeof effectiveTenant.status === 'string' ? effectiveTenant.status : null;
    const bootstrapStatus = bootstrap.effectiveState.status ?? null;
    const bootstrapError = typeof bootstrap.effectiveState.last_error === 'string' && bootstrap.effectiveState.last_error
      ? classifyGatewayFailure({
        message: bootstrap.effectiveState.last_error,
      })
      : null;
    const taskStepUnlocked =
      isTaskStepUnlocked(tenantStatus) ||
      (typeof bootstrapStatus === 'string' && bootstrapStatus.trim().toLowerCase() === 'completed');

    const payload: TenantStatusBridgePayload = {
      contract_version: THIN_BRIDGE_CONTRACT_VERSION,
      status: tenantStatus,
      bootstrap_status: bootstrapStatus,
      bootstrap_error: bootstrapError
        ? {
          tag: bootstrapError.tag,
          retryable: bootstrapError.retryable,
          message: bootstrapError.message,
          missing_scope: bootstrapError.missingScope,
          request_id: bootstrapError.requestId,
        }
        : null,
      task_step_unlocked: taskStepUnlocked,
      has_agent_output: bootstrap.progress.hasAgentOutput,
      has_droplet: !!effectiveTenant.droplet_id,
      has_gateway: !!effectiveTenant.gateway_token,
      has_agentmail: !!effectiveTenant.agentmail_inbox,
      trial_ends_at: effectiveTenant.trial_ends_at ?? null,
      plan: effectiveTenant.plan ?? null,
    };

    return res.status(200).json(payload);
  } catch (error) {
    return errorResponse(res, error);
  }
}
