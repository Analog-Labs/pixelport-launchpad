import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

  // Retry mode
  if (req.query.retry === 'true') {
    try {
      await inngest.send({ name: 'pixelport/tenant.created', data: { tenantId, trialMode: true } });
      return res.status(200).json({ action: 're-triggered', tenantId });
    } catch (err) {
      return res.status(500).json({ error: 'inngest.send failed', detail: err instanceof Error ? err.message : String(err) });
    }
  }

  const steps: Record<string, unknown> = {};
  const LITELLM_URL = process.env.LITELLM_URL!;
  const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY!;
  const DO_API_TOKEN = process.env.DO_API_TOKEN!;

  const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Step 1: validate-tenant
  let tenant: any;
  try {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    if (error || !data) throw new Error(`Tenant not found: ${tenantId}`);
    if (data.status !== 'provisioning') throw new Error(`Status is ${data.status}, expected provisioning`);
    tenant = data;
    steps['1_validate_tenant'] = { ok: true, slug: data.slug, status: data.status };
  } catch (e) {
    steps['1_validate_tenant'] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    return res.status(200).json(steps);
  }

  // Step 2: create-litellm-team
  let teamId: string;
  try {
    const r = await fetch(`${LITELLM_URL}/team/new`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${LITELLM_MASTER_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_alias: `pixelport-${tenant.slug}`, max_budget: 20, budget_duration: '30d', models: ['gpt-5.2-codex', 'gemini-2.5-flash', 'gpt-4o-mini'] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`LiteLLM ${r.status}: ${await r.text()}`);
    const body = await r.json();
    teamId = body.team_id;
    steps['2_create_litellm_team'] = { ok: true, team_id: teamId };
  } catch (e) {
    steps['2_create_litellm_team'] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    return res.status(200).json(steps);
  }

  // Step 3: generate-litellm-key
  let litellmKey: string;
  try {
    const r = await fetch(`${LITELLM_URL}/key/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${LITELLM_MASTER_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, key_alias: `pixelport-${tenant.slug}-main` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`LiteLLM ${r.status}: ${await r.text()}`);
    const body = await r.json();
    litellmKey = body.key;
    steps['3_generate_litellm_key'] = { ok: true, key_prefix: litellmKey.substring(0, 8) };
  } catch (e) {
    steps['3_generate_litellm_key'] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    return res.status(200).json(steps);
  }

  // Step 4: create-droplet (just test the API call, don't actually create)
  try {
    const r = await fetch('https://api.digitalocean.com/v2/account', {
      headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    steps['4_do_api_check'] = { ok: r.ok, status: r.status };
  } catch (e) {
    steps['4_do_api_check'] = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  steps['summary'] = 'All pre-droplet steps pass. The issue is likely in Inngest invocation, not the function logic.';

  return res.status(200).json(steps);
}
