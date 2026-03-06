import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { repairBootstrapHooksOnDroplet } from '../lib/bootstrap-hooks-repair';
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

    if (hasExistingAgentOutput && !force) {
      return res.status(409).json({
        error: 'Bootstrap already appears to have run. Pass force=true to replay it.',
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
        onboardingData: tenant.onboarding_data,
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
            onboardingData: tenant.onboarding_data,
          }),
        });
      } catch (repairError) {
        return res.status(502).json({
          error: 'Gateway rejected onboarding bootstrap and hooks repair failed',
          gateway_status: result.status,
          details: result.body,
          repair_error: repairError instanceof Error ? repairError.message : 'Unknown repair error',
        });
      }
    }

    if (!result.ok) {
      return res.status(502).json({
        error: 'Gateway rejected onboarding bootstrap',
        gateway_status: result.status,
        details: result.body,
      });
    }

    return res.status(202).json({
      accepted: true,
      gateway_status: result.status,
      existing_output_present: hasExistingAgentOutput,
      hooks_repaired: hooksRepaired,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
