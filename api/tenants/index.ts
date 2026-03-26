import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type PostgrestError } from '@supabase/supabase-js';
import type { Tenant } from '../lib/auth';
import { applyTenantMemorySettingsDefaults } from '../lib/tenant-memory-settings';
import { isEmailAllowedForProvisioning, parseProvisioningAllowlist } from '../lib/provisioning-allowlist';
import { buildOnboardingData } from '../lib/onboarding-schema';
import { TENANT_STATUS } from '../lib/tenant-status';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getBearerToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!value || !value.startsWith('Bearer ')) {
    return null;
  }

  return value.slice(7);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function withSlugSuffix(baseSlug: string, sequence: number): string {
  if (sequence <= 1) {
    return baseSlug;
  }

  const suffix = `-${sequence}`;
  const trimmedBase = baseSlug.slice(0, Math.max(1, 50 - suffix.length)).replace(/-+$/g, '');
  return `${trimmedBase}${suffix}`;
}

function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const provisioningAllowlist = parseProvisioningAllowlist(process.env.TENANT_PROVISIONING_ALLOWLIST);

    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('supabase_user_id', user.id)
      .maybeSingle();

    if (existingTenant) {
      const { gateway_token, agent_api_key, paperclip_api_key, ...safeTenant } = existingTenant;
      return res.status(200).json({ tenant: safeTenant, created: false });
    }

    if (!isEmailAllowedForProvisioning(user.email, provisioningAllowlist)) {
      return res.status(403).json({
        error: 'Tenant provisioning is currently invite-only for this environment.',
      });
    }

    const {
      company_name,
      company_url,
      mission,
      mission_goals,
      goals,
      agent_name,
      agent_tone,
      agent_avatar_id,
      starter_tasks,
      approval_policy,
      scan_results,
    } = (req.body || {}) as {
      company_name?: string;
      company_url?: string;
      mission?: string | null;
      mission_goals?: string | null;
      goals?: string[];
      agent_name?: string;
      agent_tone?: string;
      agent_avatar_id?: string;
      starter_tasks?: string[];
      approval_policy?: Record<string, unknown>;
      scan_results?: Record<string, unknown> | null;
    };

    if (!company_name || typeof company_name !== 'string' || company_name.trim().length < 2) {
      return res.status(400).json({ error: 'company_name is required and must be at least 2 characters' });
    }

    if (mission !== undefined && mission !== null && typeof mission !== 'string') {
      return res.status(400).json({ error: 'mission must be a string' });
    }

    if (mission_goals !== undefined && mission_goals !== null && typeof mission_goals !== 'string') {
      return res.status(400).json({ error: 'mission_goals must be a string' });
    }

    if (goals !== undefined && (!Array.isArray(goals) || goals.some((goal) => typeof goal !== 'string'))) {
      return res.status(400).json({ error: 'goals must be an array of strings' });
    }

    if (
      starter_tasks !== undefined &&
      (!Array.isArray(starter_tasks) || starter_tasks.some((task) => typeof task !== 'string'))
    ) {
      return res.status(400).json({ error: 'starter_tasks must be an array of strings' });
    }

    if (
      approval_policy !== undefined &&
      (typeof approval_policy !== 'object' || approval_policy === null || Array.isArray(approval_policy))
    ) {
      return res.status(400).json({ error: 'approval_policy must be an object' });
    }

    const normalizedCompanyName = company_name.trim();
    const slug = generateSlug(normalizedCompanyName);

    if (!slug) {
      return res.status(400).json({ error: 'company_name must include at least one letter or number' });
    }

    const missionCandidates = [mission, mission_goals];
    const rawMissionValue = missionCandidates.find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    ) ?? null;
    const normalizedMission = rawMissionValue ? rawMissionValue.trim() : null;
    const missionPatchValue = normalizedMission ?? undefined;

    const normalizedResult = buildOnboardingData({}, {
      company_name: normalizedCompanyName,
      company_url: typeof company_url === 'string' && company_url.trim() ? company_url.trim() : null,
      mission: missionPatchValue,
      mission_goals: missionPatchValue,
      goals: goals || [],
      agent_name: typeof agent_name === 'string' && agent_name.trim() ? agent_name.trim() : 'Chief',
      agent_tone: typeof agent_tone === 'string' && agent_tone.trim() ? agent_tone.trim().toLowerCase() : undefined,
      agent_avatar_id: typeof agent_avatar_id === 'string' && agent_avatar_id.trim() ? agent_avatar_id.trim() : undefined,
      starter_tasks: starter_tasks || undefined,
      approval_policy: approval_policy || undefined,
      scan_results: scan_results && typeof scan_results === 'object' ? scan_results : null,
    });

    if (!normalizedResult.ok) {
      return res.status(400).json({ error: `Invalid onboarding payload: ${normalizedResult.error}` });
    }

    if (normalizedResult.state.companyName.trim().length < 2) {
      return res.status(400).json({ error: 'company_name is required and must be at least 2 characters' });
    }

    const onboardingData = normalizedResult.onboardingData;

    let newTenant: Tenant | null = null;
    let insertError: PostgrestError | null = null;

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const candidateSlug = withSlugSuffix(slug, attempt);

      const result = await supabase
        .from('tenants')
        .insert({
          supabase_user_id: user.id,
          name: normalizedCompanyName,
          slug: candidateSlug,
          plan: 'trial',
          status: TENANT_STATUS.DRAFT,
          onboarding_data: onboardingData,
          settings: applyTenantMemorySettingsDefaults({
            trial_budget_usd: 20,
            timezone: resolveTimezone(),
          }),
        })
        .select('*')
        .single();

      newTenant = result.data as Tenant | null;
      insertError = result.error;

      if (!insertError && newTenant) {
        break;
      }

      if (insertError?.code !== '23505') {
        break;
      }

      const { data: racedTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('supabase_user_id', user.id)
        .maybeSingle();

      if (racedTenant) {
        const { gateway_token, agent_api_key, paperclip_api_key, ...safeRacedTenant } = racedTenant;
        return res.status(200).json({ tenant: safeRacedTenant, created: false });
      }
    }

    if (insertError || !newTenant) {
      console.error('Tenant creation error:', insertError);
      return res.status(500).json({
        error: 'Failed to create tenant workspace. Please retry.',
      });
    }

    const { gateway_token, agent_api_key, paperclip_api_key, ...safeTenant } = newTenant;
    return res.status(201).json({ tenant: safeTenant, created: true });
  } catch (error) {
    console.error('Unexpected error in tenant creation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
