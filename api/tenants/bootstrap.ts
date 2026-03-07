import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { repairBootstrapHooksOnDroplet } from '../lib/bootstrap-hooks-repair';
import { getBootstrapState, loadBootstrapSnapshot, transitionBootstrapState } from '../lib/bootstrap-state';
import { buildOnboardingBootstrapMessage, triggerOnboardingBootstrap } from '../lib/onboarding-bootstrap';
import { supabase } from '../lib/supabase';

async function countRows(table: 'agent_tasks' | 'competitors' | 'vault_sections', tenantId: string, extra?: {
  column: string;
  value: string;
}): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);

  if (extra) {
    query = query.eq(extra.column, extra.value);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to inspect ${table}: ${error.message}`);
  }

  return count ?? 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const force = req.body?.force === true;
    let bootstrapSnapshot = await loadBootstrapSnapshot({
      tenantId: tenant.id,
      fallbackOnboardingData: tenant.onboarding_data,
    });
    let onboardingData = bootstrapSnapshot.onboardingData;
    let bootstrapState = bootstrapSnapshot.state;

    if (tenant.status !== 'active') {
      return res.status(409).json({
        error: 'Tenant must be active before bootstrap can be replayed',
        status: tenant.status,
      });
    }

    if (!tenant.droplet_ip || !tenant.gateway_token) {
      return res.status(503).json({ error: 'Agent infrastructure not ready' });
    }

    const [taskCount, competitorCount, agentUpdatedVaultCount] = await Promise.all([
      countRows('agent_tasks', tenant.id),
      countRows('competitors', tenant.id),
      countRows('vault_sections', tenant.id, { column: 'last_updated_by', value: 'agent' }),
    ]);

    const hasExistingAgentOutput =
      taskCount > 0 ||
      competitorCount > 0 ||
      agentUpdatedVaultCount > 0;

    if (hasExistingAgentOutput && bootstrapState.status !== 'completed') {
      const transition = await transitionBootstrapState({
        tenantId: tenant.id,
        fallbackOnboardingData: onboardingData,
        allowedCurrentStatuses: ['not_started', 'dispatching', 'accepted', 'failed'],
        update: {
          status: 'completed',
          source: bootstrapState.source ?? 'provisioning',
        },
      });
      bootstrapSnapshot = transition.snapshot;
      onboardingData = bootstrapSnapshot.onboardingData;
      bootstrapState = bootstrapSnapshot.state;
    }

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

    if (!force && (bootstrapState.status === 'completed' || hasExistingAgentOutput)) {
      return res.status(409).json({
        error: 'Bootstrap already appears to have run. Pass force=true to replay it.',
        reason: 'bootstrap_already_completed',
        bootstrap_status: 'completed',
        task_count: taskCount,
        competitor_count: competitorCount,
        agent_updated_vault_count: agentUpdatedVaultCount,
      });
    }

    const bootstrapSource = force ? 'manual_force' : 'dashboard_replay';

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
    bootstrapState = bootstrapSnapshot.state;

    if (!dispatchTransition.changed) {
      const inProgress = bootstrapState.status === 'dispatching' || bootstrapState.status === 'accepted';
      return res.status(409).json({
        error: inProgress
          ? 'Bootstrap is already in progress.'
          : 'Bootstrap already appears to have run. Pass force=true to replay it.',
        reason: inProgress ? 'bootstrap_in_progress' : 'bootstrap_already_completed',
        bootstrap_status: bootstrapState.status,
        task_count: taskCount,
        competitor_count: competitorCount,
        agent_updated_vault_count: agentUpdatedVaultCount,
      });
    }

    let result = await triggerOnboardingBootstrap({
      gatewayUrl: `http://${tenant.droplet_ip}:18789`,
      gatewayToken: tenant.gateway_token,
      message: buildOnboardingBootstrapMessage({
        tenantName: tenant.name,
        onboardingData,
      }),
    });

    let hooksRepaired = false;

    // Older droplets were provisioned before hooks existed in openclaw.json.
    // Repair them in place so bootstrap replay can recover those tenants.
    if (!result.ok && result.status === 405) {
      try {
        await repairBootstrapHooksOnDroplet(tenant.droplet_ip, tenant.gateway_token);
        hooksRepaired = true;

        result = await triggerOnboardingBootstrap({
          gatewayUrl: `http://${tenant.droplet_ip}:18789`,
          gatewayToken: tenant.gateway_token,
          message: buildOnboardingBootstrapMessage({
            tenantName: tenant.name,
            onboardingData,
          }),
        });
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
      const transition = await transitionBootstrapState({
        tenantId: tenant.id,
        fallbackOnboardingData: onboardingData,
        allowedCurrentStatuses: ['dispatching', 'accepted'],
        update: {
          status: 'failed',
          source: bootstrapSource,
          lastError: result.body,
        },
      });
      bootstrapSnapshot = transition.snapshot;
      onboardingData = bootstrapSnapshot.onboardingData;

      return res.status(502).json({
        error: 'Gateway rejected onboarding bootstrap',
        gateway_status: result.status,
        details: result.body,
        bootstrap_status: bootstrapSnapshot.state.status,
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
      existing_output_present: hasExistingAgentOutput,
      hooks_repaired: hooksRepaired,
      bootstrap_status: bootstrapSnapshot.state.status,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
