import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

// Inline client creation — importing from a local file that re-exports inngest
// crashes Vercel's esbuild bundler at runtime. Direct imports work fine.
const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/**
 * POST /api/debug/test-provision
 *
 * Triggers a full end-to-end provisioning dry-run.
 * Protected by API_KEY_ENCRYPTION_KEY as a shared secret.
 *
 * Query params:
 *   ?secret=<API_KEY_ENCRYPTION_KEY>  — required
 *   &mode=new                         — force create new test tenant (default: reuse stuck ones)
 *   &cleanup=true                     — delete existing test tenants and their agents instead of provisioning
 *
 * NOT for production use — remove after Phase 0.9 gate.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  // Auth: require shared secret
  const secret = req.query.secret as string;
  const expectedSecret = process.env.API_KEY_ENCRYPTION_KEY;
  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid or missing secret' });
  }

  const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check required provisioning env vars
  const missingVars = [];
  if (!process.env.LITELLM_URL) missingVars.push('LITELLM_URL');
  if (!process.env.LITELLM_MASTER_KEY) missingVars.push('LITELLM_MASTER_KEY');
  if (!process.env.DO_API_TOKEN) missingVars.push('DO_API_TOKEN');
  if (!process.env.INNGEST_EVENT_KEY) missingVars.push('INNGEST_EVENT_KEY');
  if (missingVars.length > 0) {
    return res.status(500).json({ error: `Missing env vars: ${missingVars.join(', ')}` });
  }

  const mode = req.query.mode as string;
  const cleanup = req.query.cleanup === 'true';

  try {
    // Cleanup mode: delete test tenants
    if (cleanup) {
      const { data: testTenants } = await supabase
        .from('tenants')
        .select('id, slug, status, droplet_id')
        .like('slug', 'pixelport-dry-run%');

      if (!testTenants || testTenants.length === 0) {
        return res.status(200).json({ message: 'No test tenants found to clean up' });
      }

      const doToken = process.env.DO_API_TOKEN;
      const results = [];
      for (const t of testTenants) {
        // Delete DO droplet if it exists
        let dropletDeleted = false;
        if (t.droplet_id && doToken) {
          try {
            const doResp = await fetch(`https://api.digitalocean.com/v2/droplets/${t.droplet_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${doToken}` },
            });
            dropletDeleted = doResp.status === 204 || doResp.status === 404;
          } catch {
            dropletDeleted = false;
          }
        }
        // Delete agents first (FK constraint)
        await supabase.from('agents').delete().eq('tenant_id', t.id);
        // Delete chat sessions and messages
        await supabase.from('chat_messages').delete().eq('tenant_id', t.id);
        await supabase.from('chat_sessions').delete().eq('tenant_id', t.id);
        // Delete tenant
        const { error } = await supabase.from('tenants').delete().eq('id', t.id);
        results.push({
          id: t.id,
          slug: t.slug,
          status: t.status,
          droplet_id: t.droplet_id,
          deleted: !error,
          droplet_deleted: dropletDeleted,
          error: error?.message,
        });
      }

      return res.status(200).json({
        action: 'cleanup',
        tenants_processed: results,
        note: 'Test auth users are NOT deleted — they are harmless in Supabase Auth.',
      });
    }

    // Check for existing test tenants stuck in provisioning
    const { data: existingTest } = await supabase
      .from('tenants')
      .select('id, slug, status, droplet_id, droplet_ip, created_at')
      .like('slug', 'pixelport-dry-run%')
      .order('created_at', { ascending: false })
      .limit(5);

    // If there's a stuck provisioning tenant and we're not forcing new
    if (existingTest && existingTest.length > 0 && mode !== 'new') {
      const stuck = existingTest.find((t) => t.status === 'provisioning');

      if (stuck) {
        // Re-trigger provisioning for stuck tenant
        await inngest.send({
          name: 'pixelport/tenant.created',
          data: {
            tenantId: stuck.id,
            trialMode: true,
          },
        });

        return res.status(200).json({
          action: 're-triggered',
          message: `Found stuck tenant "${stuck.slug}" (status: ${stuck.status}). Re-sent provisioning event.`,
          tenant: stuck,
          monitor: 'Check Inngest dashboard at https://app.inngest.com for function execution.',
          cleanup_url: `POST /api/debug/test-provision?secret=<key>&cleanup=true`,
        });
      }

      // There are existing test tenants but none stuck — show them
      if (mode !== 'new') {
        return res.status(200).json({
          action: 'existing-found',
          message: 'Found existing test tenants. Use ?mode=new to create a fresh one, or ?cleanup=true to remove them.',
          tenants: existingTest,
        });
      }
    }

    // Create new test tenant
    const testSlug = `pixelport-dry-run-${Date.now().toString(36)}`;
    const testEmail = `test-${testSlug}@pixelport-test.local`;

    // Create a test auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      email_confirm: true, // Auto-confirm so we don't need to verify
      user_metadata: { test: true, dry_run: true },
    });

    if (authError || !authUser?.user) {
      return res.status(500).json({
        error: 'Failed to create test auth user',
        detail: authError?.message,
      });
    }

    // Create test tenant
    const { data: newTenant, error: insertError } = await supabase
      .from('tenants')
      .insert({
        supabase_user_id: authUser.user.id,
        name: 'PixelPort Dry Run Test',
        slug: testSlug,
        plan: 'trial',
        status: 'provisioning',
        onboarding_data: {
          company_name: 'PixelPort Dry Run Test',
          company_url: 'https://pixelport.ai',
          goals: ['Test provisioning pipeline'],
          agent_name: 'TestBot',
          agent_tone: 'professional',
          agent_avatar_url: 'amber-l',
          completed_at: new Date().toISOString(),
        },
        settings: {
          trial_budget_usd: 5,
          timezone: 'UTC',
        },
      })
      .select('*')
      .single();

    if (insertError || !newTenant) {
      return res.status(500).json({
        error: 'Failed to create test tenant',
        detail: insertError?.message,
      });
    }

    // Send Inngest provisioning event
    await inngest.send({
      name: 'pixelport/tenant.created',
      data: {
        tenantId: newTenant.id,
        trialMode: true,
      },
    });

    // Strip gateway token from response
    const { gateway_token, ...safeTenant } = newTenant;

    return res.status(201).json({
      action: 'created',
      message: `Test tenant "${testSlug}" created and provisioning event sent.`,
      tenant: safeTenant,
      monitor: 'Check Inngest dashboard at https://app.inngest.com for the provision-tenant function execution.',
      expected_steps: [
        '1. validate-tenant',
        '2. create-litellm-team',
        '3. generate-litellm-key',
        '4. create-droplet (was previously blocked — should work now)',
        '5. wait-for-droplet (polls up to 5 min)',
        '6. create-agentmail-inbox (skipped if no API key)',
        '7. store-infra-refs',
        '8. wait-for-gateway (polls up to 5 min)',
        '9. configure-agents',
        '10. create-agent-records',
        '11. send-welcome',
        '12. mark-active',
      ],
      cleanup_url: `POST /api/debug/test-provision?secret=<key>&cleanup=true`,
    });
  } catch (error) {
    console.error('Test provision error:', error);
    return res.status(500).json({
      error: 'Unexpected error',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
