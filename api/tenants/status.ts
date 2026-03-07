import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { getBootstrapState } from '../lib/bootstrap-state';
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const bootstrapState = getBootstrapState(tenant.onboarding_data);
    const [taskCount, competitorCount, agentUpdatedVaultCount] = await Promise.all([
      countRows('agent_tasks', tenant.id),
      countRows('competitors', tenant.id),
      countRows('vault_sections', tenant.id, { column: 'last_updated_by', value: 'agent' }),
    ]);

    return res.status(200).json({
      status: tenant.status,
      bootstrap_status: bootstrapState.status,
      has_agent_output: taskCount > 0 || competitorCount > 0 || agentUpdatedVaultCount > 0,
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
