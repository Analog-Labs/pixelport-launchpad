import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { buildOnboardingData } from '../lib/onboarding-schema';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const patch = req.body;

    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const normalized = buildOnboardingData(tenant.onboarding_data, patch);
    if (!normalized.ok) {
      return res.status(400).json({ error: `Invalid onboarding payload: ${normalized.error}` });
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({ onboarding_data: normalized.onboardingData })
      .eq('id', tenant.id)
      .select('onboarding_data')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save onboarding data' });
    }

    return res.status(200).json({ success: true, onboarding_data: data?.onboarding_data ?? {} });
  } catch (error) {
    return errorResponse(res, error);
  }
}
