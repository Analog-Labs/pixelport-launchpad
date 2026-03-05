import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId required' });
  }

  // If ?retry=true, just send the Inngest event
  if (req.query.retry === 'true') {
    try {
      await inngest.send({
        name: 'pixelport/tenant.created',
        data: { tenantId, trialMode: true },
      });
      return res.status(200).json({ action: 're-triggered', tenantId });
    } catch (err) {
      return res.status(500).json({
        error: 'inngest.send failed',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const results: Record<string, unknown> = {};

  // Step 1: Check env vars
  results.env = {
    SUPABASE_PROJECT_URL: !!process.env.SUPABASE_PROJECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    LITELLM_URL: process.env.LITELLM_URL || 'MISSING',
    LITELLM_MASTER_KEY: process.env.LITELLM_MASTER_KEY ? `${process.env.LITELLM_MASTER_KEY.substring(0, 8)}...` : 'MISSING',
    DO_API_TOKEN: process.env.DO_API_TOKEN ? `${process.env.DO_API_TOKEN.substring(0, 10)}...` : 'MISSING',
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY ? `${process.env.INNGEST_EVENT_KEY.substring(0, 8)}...` : 'MISSING',
    SSH_PRIVATE_KEY: process.env.SSH_PRIVATE_KEY ? `${process.env.SSH_PRIVATE_KEY.substring(0, 20)}...` : 'MISSING',
  };

  // Step 2: Check tenant in Supabase
  try {
    const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supabase.from('tenants').select('id,slug,status,litellm_team_id').eq('id', tenantId).single();
    results.tenant = error ? { error: error.message } : data;
  } catch (e) {
    results.tenant = { error: String(e) };
  }

  // Step 3: Check LiteLLM health
  try {
    const r = await fetch(`${process.env.LITELLM_URL}/health`, {
      headers: { Authorization: `Bearer ${process.env.LITELLM_MASTER_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    results.litellm_health = { status: r.status, ok: r.ok };
  } catch (e) {
    results.litellm_health = { error: e instanceof Error ? e.message : String(e) };
  }

  // Step 4: Try creating a LiteLLM team (dry run with unique alias)
  try {
    const slug = (results.tenant as any)?.slug || 'unknown';
    const r = await fetch(`${process.env.LITELLM_URL}/team/new`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LITELLM_MASTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_alias: `pixelport-${slug}`,
        max_budget: 20,
        budget_duration: '30d',
        models: ['gpt-5.2-codex', 'gemini-2.5-flash', 'gpt-4o-mini'],
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.text();
    results.litellm_team_create = { status: r.status, ok: r.ok, body: body.substring(0, 500) };
  } catch (e) {
    results.litellm_team_create = { error: e instanceof Error ? e.message : String(e) };
  }

  // Step 5: Check DO API
  try {
    const r = await fetch('https://api.digitalocean.com/v2/account', {
      headers: { Authorization: `Bearer ${process.env.DO_API_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    results.do_api = { status: r.status, ok: r.ok };
  } catch (e) {
    results.do_api = { error: e instanceof Error ? e.message : String(e) };
  }

  return res.status(200).json(results);
}
