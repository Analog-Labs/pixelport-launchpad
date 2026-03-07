import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';
import { markBootstrapCompletedIfInProgress } from '../lib/bootstrap-state';
import { supabase } from '../lib/supabase';

/**
 * POST /api/agent/competitors — Chief adds a competitor profile
 * Auth: X-Agent-Key header (per-tenant agent API key)
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);

    const {
      company_name,
      website_url,
      summary,
      recent_activity,
      threat_level,
      analysis,
    } = req.body || {};

    if (!company_name) {
      return res.status(400).json({ error: 'Missing required field: company_name' });
    }

    if (threat_level) {
      const validLevels = ['low', 'medium', 'high'];
      if (!validLevels.includes(threat_level)) {
        return res.status(400).json({ error: `Invalid threat_level. Must be one of: ${validLevels.join(', ')}` });
      }
    }

    const insertData: Record<string, unknown> = {
      tenant_id: tenant.id,
      company_name,
    };

    if (website_url) insertData.website_url = website_url;
    if (summary) insertData.summary = summary;
    if (recent_activity) insertData.recent_activity = recent_activity;
    if (threat_level) insertData.threat_level = threat_level;
    if (analysis) insertData.analysis = analysis;

    const { data, error } = await supabase
      .from('competitors')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create competitor:', error);
      return res.status(500).json({ error: 'Failed to create competitor' });
    }

    try {
      await markBootstrapCompletedIfInProgress({
        tenantId: tenant.id,
      });
    } catch (bootstrapError) {
      console.warn('Competitor write succeeded but failed to mark bootstrap completed:', bootstrapError);
    }

    return res.status(201).json(data);
  } catch (error) {
    return errorResponse(res, error);
  }
}
