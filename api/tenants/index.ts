import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { applyTenantMemorySettingsDefaults } from '../lib/tenant-memory-settings';
import { isEmailAllowedForProvisioning, parseProvisioningAllowlist } from '../lib/provisioning-allowlist';

// Inline client creation — importing from a local file that re-exports inngest
// crashes Vercel's esbuild bundler at runtime. Direct imports work fine.
const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VALID_TONES = new Set(['casual', 'professional', 'bold']);
const VALID_AVATARS = new Set([
  'amber-l',
  'purple-zap',
  'blue-bot',
  'green-brain',
  'pink-sparkle',
  'orange-fire',
]);

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
      const { gateway_token, ...safeTenant } = existingTenant;
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
      goals,
      agent_name,
      agent_tone,
      agent_avatar_url,
      scan_results,
    } = (req.body || {}) as {
      company_name?: string;
      company_url?: string;
      mission?: string | null;
      goals?: string[];
      agent_name?: string;
      agent_tone?: string;
      agent_avatar_url?: string;
      scan_results?: Record<string, unknown> | null;
    };

    if (!company_name || typeof company_name !== 'string' || company_name.trim().length < 2) {
      return res.status(400).json({ error: 'company_name is required and must be at least 2 characters' });
    }

    if (agent_tone && !VALID_TONES.has(agent_tone)) {
      return res.status(400).json({ error: 'agent_tone must be: casual, professional, or bold' });
    }

    if (agent_avatar_url && !VALID_AVATARS.has(agent_avatar_url)) {
      return res.status(400).json({ error: 'Invalid avatar selection' });
    }

    if (mission !== undefined && mission !== null && typeof mission !== 'string') {
      return res.status(400).json({ error: 'mission must be a string' });
    }

    if (goals !== undefined && (!Array.isArray(goals) || goals.some((goal) => typeof goal !== 'string'))) {
      return res.status(400).json({ error: 'goals must be an array of strings' });
    }

    const normalizedCompanyName = company_name.trim();
    const slug = generateSlug(normalizedCompanyName);

    if (!slug) {
      return res.status(400).json({ error: 'company_name must include at least one letter or number' });
    }

    const onboardingData = {
      company_name: normalizedCompanyName,
      company_url: typeof company_url === 'string' && company_url.trim() ? company_url.trim() : null,
      mission: typeof mission === 'string' && mission.trim() ? mission.trim() : null,
      goals: goals || [],
      agent_name: typeof agent_name === 'string' && agent_name.trim() ? agent_name.trim() : 'Luna',
      agent_tone: agent_tone || 'professional',
      agent_avatar_url: agent_avatar_url || 'amber-l',
      scan_results: scan_results && typeof scan_results === 'object' ? scan_results : null,
      completed_at: new Date().toISOString(),
    };

    let newTenant: Record<string, any> | null = null;
    let insertError: { code?: string; message?: string } | null = null;

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const candidateSlug = withSlugSuffix(slug, attempt);

      const result = await supabase
        .from('tenants')
        .insert({
          supabase_user_id: user.id,
          name: normalizedCompanyName,
          slug: candidateSlug,
          plan: 'trial',
          status: 'provisioning',
          onboarding_data: onboardingData,
          settings: applyTenantMemorySettingsDefaults({
            trial_budget_usd: 20,
            timezone: resolveTimezone(),
          }),
        })
        .select('*')
        .single();

      newTenant = result.data;
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
        const { gateway_token, ...safeRacedTenant } = racedTenant;
        return res.status(200).json({ tenant: safeRacedTenant, created: false });
      }
    }

    if (insertError || !newTenant) {
      console.error('Tenant creation error:', insertError);
      return res.status(500).json({
        error: 'Failed to create tenant workspace. Please retry.',
      });
    }

    try {
      await inngest.send({
        name: 'pixelport/tenant.created',
        data: {
          tenantId: newTenant.id,
          trialMode: true,
        },
      });
    } catch (inngestError) {
      console.error('Failed to send Inngest provisioning event:', inngestError);
      // Tenant is created but provisioning won't start — return 201 with warning
      const { gateway_token, ...safeTenant } = newTenant;
      return res.status(201).json({
        tenant: safeTenant,
        created: true,
        warning: 'Tenant created but provisioning event failed to send. Use retry endpoint.',
      });
    }

    const { gateway_token, ...safeTenant } = newTenant;
    return res.status(201).json({ tenant: safeTenant, created: true });
  } catch (error) {
    console.error('Unexpected error in tenant creation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
