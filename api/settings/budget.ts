import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

const LITELLM_URL = process.env.LITELLM_URL;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY;

function getTrialBudget(tenantSettings: Record<string, unknown> | null | undefined): number {
  const raw = tenantSettings?.trial_budget_usd;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 20;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  try {
    const { tenant } = await authenticateRequest(req);
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;

    if (req.method === 'GET') {
      const budget = getTrialBudget(settings);

      if (!tenant.litellm_team_id || !LITELLM_URL || !LITELLM_MASTER_KEY) {
        return res.status(200).json({
          budget_usd: budget,
          spend_usd: 0,
          remaining_usd: budget,
          litellm_connected: false,
        });
      }

      const teamResponse = await fetch(`${LITELLM_URL}/team/info?team_id=${tenant.litellm_team_id}`, {
        headers: { Authorization: `Bearer ${LITELLM_MASTER_KEY}` },
      });

      if (!teamResponse.ok) {
        return res.status(500).json({ error: 'Failed to fetch budget info from LiteLLM' });
      }

      const teamData = (await teamResponse.json()) as { spend?: number };
      const spend = typeof teamData.spend === 'number' ? teamData.spend : 0;

      return res.status(200).json({
        budget_usd: budget,
        spend_usd: spend,
        remaining_usd: Math.max(0, budget - spend),
        litellm_connected: true,
      });
    }

    if (req.method === 'PATCH') {
      const { trial_budget_usd } = (req.body ?? {}) as { trial_budget_usd?: number };

      if (typeof trial_budget_usd !== 'number' || trial_budget_usd < 0) {
        return res.status(400).json({ error: 'trial_budget_usd must be a non-negative number' });
      }

      const newSettings = { ...settings, trial_budget_usd };
      const { error: dbError } = await supabase
        .from('tenants')
        .update({ settings: newSettings })
        .eq('id', tenant.id);

      if (dbError) {
        return res.status(500).json({ error: 'Failed to update budget' });
      }

      if (tenant.litellm_team_id && LITELLM_URL && LITELLM_MASTER_KEY) {
        await fetch(`${LITELLM_URL}/team/update`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LITELLM_MASTER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team_id: tenant.litellm_team_id,
            max_budget: trial_budget_usd,
          }),
        });
      }

      return res.status(200).json({ success: true, trial_budget_usd });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
