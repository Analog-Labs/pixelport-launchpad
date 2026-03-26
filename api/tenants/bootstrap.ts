import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { repairBootstrapHooksOnDroplet } from '../lib/bootstrap-hooks-repair';
import { loadBootstrapSnapshot, reconcileBootstrapState, transitionBootstrapState } from '../lib/bootstrap-state';
import { buildOnboardingBootstrapMessage } from '../lib/onboarding-bootstrap';
import { approveGatewayPairingViaSsh } from '../lib/openclaw-pairing-ssh';
import { supabase } from '../lib/supabase';
import {
  classifyGatewayFailure,
  dispatchBootstrapWithPairingRecovery,
  formatGatewayDiagnostic,
} from '../lib/openclaw-bootstrap-guard';

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function withManualBootstrapProvenance(params: {
  onboardingData: JsonRecord;
  userId: string;
  force: boolean;
  at?: string;
}): JsonRecord {
  const nextOnboardingData = { ...params.onboardingData };
  const existingProvenance = isJsonRecord(nextOnboardingData.startup_provenance)
    ? nextOnboardingData.startup_provenance
    : {};

  nextOnboardingData.startup_provenance = {
    ...existingProvenance,
    manual_bootstrap: {
      startup_source: 'manual_bootstrap',
      invoked_by_user_id: params.userId,
      invoked_at: params.at ?? new Date().toISOString(),
      force: params.force,
    },
  };

  return nextOnboardingData;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant, userId } = await authenticateRequest(req);
    const force = req.body?.force === true;
    let bootstrapSnapshot = await loadBootstrapSnapshot({
      tenantId: tenant.id,
      fallbackOnboardingData: tenant.onboarding_data,
    });
    let onboardingData = bootstrapSnapshot.onboardingData;

    if (tenant.status !== 'active') {
      return res.status(409).json({
        error: 'Tenant must be active before bootstrap can be replayed',
        status: tenant.status,
      });
    }

    if (!tenant.droplet_ip || !tenant.gateway_token) {
      return res.status(503).json({ error: 'Agent infrastructure not ready' });
    }

    const provenanceOnboardingData = withManualBootstrapProvenance({
      onboardingData,
      userId,
      force,
    });
    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({ onboarding_data: provenanceOnboardingData })
        .eq('id', tenant.id)
        .select('onboarding_data')
        .single();

      if (error) {
        console.warn(
          `[tenants/bootstrap] Failed to persist manual bootstrap provenance for tenant ${tenant.id}: ${error.message}`,
        );
      } else {
        onboardingData = (data?.onboarding_data as JsonRecord | null | undefined) ?? provenanceOnboardingData;
      }
    } catch (provenanceError) {
      console.warn(
        `[tenants/bootstrap] Unexpected provenance persistence error for tenant ${tenant.id}: ${
          provenanceError instanceof Error ? provenanceError.message : String(provenanceError)
        }`,
      );
    }

    const bootstrap = await reconcileBootstrapState({
      tenantId: tenant.id,
      fallbackOnboardingData: onboardingData,
    });
    bootstrapSnapshot = bootstrap.snapshot;
    onboardingData = bootstrapSnapshot.onboardingData;
    const bootstrapState = bootstrap.effectiveState;
    const { taskCount, competitorCount, agentUpdatedVaultCount, hasAgentOutput } = bootstrap.progress;

    if (!force && (bootstrapState.status === 'dispatching' || bootstrapState.status === 'accepted')) {
      return res.status(409).json({
        error: 'Bootstrap is already in progress.',
        reason: 'bootstrap_in_progress',
        bootstrap_status: bootstrapState.status,
        task_count: taskCount,
        competitor_count: competitorCount,
        agent_updated_vault_count: agentUpdatedVaultCount,
      });
    }

    if (!force && bootstrapState.status === 'completed') {
      return res.status(409).json({
        error: 'Bootstrap already appears to have run. Pass force=true to replay it.',
        reason: 'bootstrap_already_completed',
        bootstrap_status: 'completed',
        task_count: taskCount,
        competitor_count: competitorCount,
        agent_updated_vault_count: agentUpdatedVaultCount,
      });
    }

    const bootstrapSource = 'manual_bootstrap';

    const dispatchTransition = await transitionBootstrapState({
      tenantId: tenant.id,
      fallbackOnboardingData: onboardingData,
      allowedCurrentStatuses: force ? undefined : ['not_started', 'failed'],
      preserveCurrentState: !force,
      update: {
        status: 'dispatching',
        source: bootstrapSource,
      },
    });
    bootstrapSnapshot = dispatchTransition.snapshot;
    onboardingData = bootstrapSnapshot.onboardingData;
    const persistedBootstrapState = bootstrapSnapshot.state;

    if (!dispatchTransition.changed) {
      const inProgress =
        persistedBootstrapState.status === 'dispatching' || persistedBootstrapState.status === 'accepted';
      return res.status(409).json({
        error: inProgress
          ? 'Bootstrap is already in progress.'
          : 'Bootstrap already appears to have run. Pass force=true to replay it.',
        reason: inProgress ? 'bootstrap_in_progress' : 'bootstrap_already_completed',
        bootstrap_status: persistedBootstrapState.status,
        task_count: taskCount,
        competitor_count: competitorCount,
        agent_updated_vault_count: agentUpdatedVaultCount,
      });
    }

    const gatewayHttpUrl = `http://${tenant.droplet_ip}:18789`;
    const gatewayWsUrl = `ws://${tenant.droplet_ip}:18789`;
    const dispatchBootstrap = async () => {
      return await dispatchBootstrapWithPairingRecovery({
        gatewayHttpUrl,
        gatewayWsUrl,
        gatewayToken: tenant.gateway_token,
        message: buildOnboardingBootstrapMessage({
          tenantName: tenant.name,
          onboardingData,
        }),
        fallbackPairingApproval: async ({ diagnostics }) => {
          return await approveGatewayPairingViaSsh({
            host: tenant.droplet_ip!,
            gatewayToken: tenant.gateway_token!,
            requestId: diagnostics.requestId,
          });
        },
      });
    };

    let result = await dispatchBootstrap();

    let hooksRepaired = false;

    // Older droplets were provisioned before hooks existed in openclaw.json.
    // Repair them in place so bootstrap replay can recover those tenants.
    if (!result.ok && result.status === 405) {
      try {
        await repairBootstrapHooksOnDroplet(tenant.droplet_ip, tenant.gateway_token);
        hooksRepaired = true;

        result = await dispatchBootstrap();
      } catch (repairError) {
        const transition = await transitionBootstrapState({
          tenantId: tenant.id,
          fallbackOnboardingData: onboardingData,
          allowedCurrentStatuses: ['dispatching', 'accepted'],
          update: {
            status: 'failed',
            source: bootstrapSource,
            lastError: repairError instanceof Error ? repairError.message : 'Unknown repair error',
          },
        });
        bootstrapSnapshot = transition.snapshot;
        onboardingData = bootstrapSnapshot.onboardingData;

        return res.status(502).json({
          error: 'Gateway rejected onboarding bootstrap and hooks repair failed',
          gateway_status: result.status,
          details: result.body,
          bootstrap_status: bootstrapSnapshot.state.status,
          repair_error: repairError instanceof Error ? repairError.message : 'Unknown repair error',
        });
      }
    }

    if (!result.ok) {
      const diagnostics = result.diagnostics ?? classifyGatewayFailure({
        status: result.status,
        message: result.body,
      });
      const failureMessage = `${formatGatewayDiagnostic(diagnostics)}${
        result.autoPairAttempted ? ` autoPair=${result.autoPairReason ?? 'attempted'}` : ''
      }`;

      const transition = await transitionBootstrapState({
        tenantId: tenant.id,
        fallbackOnboardingData: onboardingData,
        allowedCurrentStatuses: ['dispatching', 'accepted'],
        update: {
          status: 'failed',
          source: bootstrapSource,
          lastError: failureMessage,
        },
      });
      bootstrapSnapshot = transition.snapshot;
      onboardingData = bootstrapSnapshot.onboardingData;

      return res.status(502).json({
        error: 'Gateway rejected onboarding bootstrap',
        gateway_status: result.status,
        details: result.body,
        bootstrap_status: bootstrapSnapshot.state.status,
        diagnostics,
        auto_pair_attempted: result.autoPairAttempted,
        auto_pair_approved: result.autoPairApproved,
        auto_pair_reason: result.autoPairReason,
      });
    }

    const transition = await transitionBootstrapState({
      tenantId: tenant.id,
      fallbackOnboardingData: onboardingData,
      allowedCurrentStatuses: ['dispatching', 'accepted'],
      update: {
        status: 'accepted',
        source: bootstrapSource,
      },
    });
    bootstrapSnapshot = transition.snapshot;
    onboardingData = bootstrapSnapshot.onboardingData;

    return res.status(202).json({
      accepted: true,
      gateway_status: result.status,
      existing_output_present: hasAgentOutput,
      hooks_repaired: hooksRepaired,
      bootstrap_status: bootstrapSnapshot.state.status,
      startup_source: 'manual_bootstrap',
      forced: force,
      auto_pair_attempted: result.autoPairAttempted,
      auto_pair_approved: result.autoPairApproved,
      auto_pair_reason: result.autoPairReason,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
