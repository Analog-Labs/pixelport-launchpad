import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

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

    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('supabase_user_id', user.id)
      .maybeSingle();

    if (existingTenant) {
      const { gateway_token, ...safeTenant } = existingTenant;
      return res.status(200).json({ tenant: safeTenant, created: false });
    }

    const {
      company_name,
      company_url,
      goals,
      agent_name,
      agent_tone,
      agent_avatar_url,
    } = (req.body || {}) as {
      company_name?: string;
      company_url?: string;
      goals?: string[];
      agent_name?: string;
      agent_tone?: string;
      agent_avatar_url?: string;
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
      goals: goals || [],
      agent_name: typeof agent_name === 'string' && agent_name.trim() ? agent_name.trim() : 'Luna',
      agent_tone: agent_tone || 'professional',
      agent_avatar_url: agent_avatar_url || 'amber-l',
      completed_at: new Date().toISOString(),
    };

    const { data: newTenant, error: insertError } = await supabase
      .from('tenants')
      .insert({
        supabase_user_id: user.id,
        name: normalizedCompanyName,
        slug,
        plan: 'trial',
        status: 'provisioning',
        onboarding_data: onboardingData,
        settings: {
          trial_budget_usd: 20,
          timezone: resolveTimezone(),
        },
      })
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: racedTenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('supabase_user_id', user.id)
          .maybeSingle();

        if (racedTenant) {
          const { gateway_token, ...safeRacedTenant } = racedTenant;
          return res.status(200).json({ tenant: safeRacedTenant, created: false });
        }

        return res.status(409).json({ error: 'A tenant with this company name already exists. Please try another name.' });
      }

      console.error('Tenant creation error:', insertError);
      return res.status(500).json({ error: 'Failed to create tenant' });
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
