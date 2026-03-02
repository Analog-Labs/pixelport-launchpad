# Codex Slice 4 — Provisioning Pipeline (Inngest + cloud-init)

**Priority:** 🟡 Blocked on Slices 1-3
**Assigned to:** Codex
**Depends on:** Slice 1 (LiteLLM deployed), Slice 2 (schema migrated), Slice 3 (API bridge + Inngest client)
**Estimated time:** 3-4 hours

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets a visible AI agent (customizable name/avatar/tone) with invisible sub-agents behind the scenes.

**Where does provisioning fit?** When a new customer signs up and completes onboarding, we need to automatically spin up their entire infrastructure:
- A DigitalOcean droplet running OpenClaw (their AI agent runtime)
- A LiteLLM team with budget cap (for cost isolation)
- An AgentMail inbox (for email capabilities)
- Agent configurations in the database

This is a 12-step workflow orchestrated by Inngest (a durable workflow engine). If any step fails, Inngest retries it. The workflow is the backbone of tenant provisioning.

**Key Go Package adjustments:**
- **cloud-init primary** (not SSH) for droplet setup — SSH finicky from containers
- **Budget read from tenant settings** (`tenants.settings.trial_budget_usd`), not hardcoded
- **Growth Swarm droplet CAN be used** for validation testing

**How this connects to other slices:**
- Slice 1 (LiteLLM) — provisioning creates a LiteLLM team + virtual key per tenant
- Slice 2 (Schema) — provisioning reads/writes the tenants and agents tables
- Slice 3 (API Bridge) — provisioning uses the Inngest client from `api/inngest/client.ts`

**Full project docs:**
- Product spec: `docs/pixelport-master-plan-v2.md` (Section 11: Infrastructure & Deployment)
- Go Package: `docs/phase0/cto-phase0-go-package.md`
- OpenClaw reference: `docs/openclaw-reference.md`
- Project coordination: `docs/project-coordination-system.md`

---

## Repository Access

- **Repo:** https://github.com/Analog-Labs/pixelport-launchpad
- **Clone:** `git clone https://github.com/Analog-Labs/pixelport-launchpad.git`
- All work happens in this monorepo — no other repos needed
- Read `CLAUDE.md` first, then `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md`
- After completing work: update SESSION-LOG.md and ACTIVE-PLAN.md, commit and push

---

## What You're Building

1. **Inngest provisioning workflow** — 12-step durable workflow triggered when a tenant is created
2. **cloud-init template** — Bootstrap script for new DigitalOcean droplets
3. **OpenClaw config template** — Per-tenant agent configuration
4. **SOUL.md template** — Parameterized agent persona template
5. **Inngest serve endpoint** — Vercel API route that exposes Inngest functions

---

## Deliverables

### File 1: `api/inngest/functions/provision-tenant.ts`

```typescript
/**
 * 12-Step Tenant Provisioning Workflow
 *
 * Triggered by: "pixelport/tenant.created" event
 * Steps:
 *  1. Validate tenant data
 *  2. Create LiteLLM team with budget cap
 *  3. Generate LiteLLM virtual key
 *  4. Create DigitalOcean droplet (cloud-init)
 *  5. Wait for droplet to be ready
 *  6. Create AgentMail inbox
 *  7. Store infrastructure references in DB
 *  8. Wait for OpenClaw gateway health
 *  9. Configure OpenClaw agents
 * 10. Create agent records in DB
 * 11. Send welcome message via AgentMail
 * 12. Mark tenant as active
 */

import { inngest } from '../client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LITELLM_URL = process.env.LITELLM_URL!;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY!;
const DO_API_TOKEN = process.env.DO_API_TOKEN!;
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY!;
const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:2026.2.24';

export const provisionTenant = inngest.createFunction(
  {
    id: 'provision-tenant',
    name: 'Provision New Tenant',
    retries: 3,
  },
  { event: 'pixelport/tenant.created' },
  async ({ event, step }) => {
    const { tenantId } = event.data;

    // =========================================================================
    // STEP 1: Validate tenant data
    // =========================================================================
    const tenant = await step.run('validate-tenant', async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (error || !data) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      if (data.status !== 'provisioning') {
        throw new Error(`Tenant status is ${data.status}, expected 'provisioning'`);
      }

      return data;
    });

    // =========================================================================
    // STEP 2: Create LiteLLM team with budget cap
    // =========================================================================
    const litellmTeam = await step.run('create-litellm-team', async () => {
      // Read budget from tenant settings (configurable, not hardcoded)
      const budgetUsd = tenant.settings?.trial_budget_usd || 20;

      const response = await fetch(`${LITELLM_URL}/team/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_alias: `pixelport-${tenant.slug}`,
          max_budget: budgetUsd,
          budget_duration: '30d',
          models: ['gpt-5.2-codex', 'gemini-2.5-flash', 'gpt-4o-mini'],
        }),
      });

      if (!response.ok) {
        throw new Error(`LiteLLM team creation failed: ${await response.text()}`);
      }

      return response.json();
    });

    // =========================================================================
    // STEP 3: Generate LiteLLM virtual key
    // =========================================================================
    const litellmKey = await step.run('generate-litellm-key', async () => {
      const response = await fetch(`${LITELLM_URL}/key/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: litellmTeam.team_id,
          key_alias: `pixelport-${tenant.slug}-main`,
        }),
      });

      if (!response.ok) {
        throw new Error(`LiteLLM key generation failed: ${await response.text()}`);
      }

      return response.json();
    });

    // =========================================================================
    // STEP 4: Create DigitalOcean droplet with cloud-init
    // =========================================================================
    const droplet = await step.run('create-droplet', async () => {
      // Generate a gateway token for this tenant
      const gatewayToken = `gw-${crypto.randomUUID()}`;

      // Build cloud-init user data
      const cloudInit = buildCloudInit({
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        gatewayToken,
        openclawImage: OPENCLAW_IMAGE,
        litellmUrl: LITELLM_URL,
        litellmKey: litellmKey.key,
        agentmailApiKey: AGENTMAIL_API_KEY,
        onboardingData: tenant.onboarding_data || {},
      });

      const response = await fetch('https://api.digitalocean.com/v2/droplets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `pixelport-${tenant.slug}`,
          region: 'nyc1',
          size: 's-2vcpu-4gb',  // $24/mo — 2 vCPU, 4GB RAM
          image: 'docker-20-04',  // Ubuntu 20.04 with Docker pre-installed
          user_data: cloudInit,
          tags: ['pixelport', `tenant-${tenant.slug}`],
        }),
      });

      if (!response.ok) {
        throw new Error(`Droplet creation failed: ${await response.text()}`);
      }

      const result = await response.json();
      return {
        dropletId: String(result.droplet.id),
        gatewayToken,
      };
    });

    // =========================================================================
    // STEP 5: Wait for droplet to be ready (poll for IP)
    // =========================================================================
    const dropletIp = await step.run('wait-for-droplet', async () => {
      // Poll DO API until droplet has an IP
      const maxAttempts = 30;
      const pollInterval = 10000; // 10 seconds

      for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(
          `https://api.digitalocean.com/v2/droplets/${droplet.dropletId}`,
          { headers: { 'Authorization': `Bearer ${DO_API_TOKEN}` } }
        );

        if (!response.ok) continue;

        const data = await response.json();
        const networks = data.droplet?.networks?.v4 || [];
        const publicIp = networks.find((n: any) => n.type === 'public')?.ip_address;

        if (publicIp && data.droplet.status === 'active') {
          return publicIp;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      throw new Error('Droplet did not become ready within 5 minutes');
    });

    // =========================================================================
    // STEP 6: Create AgentMail inbox
    // =========================================================================
    const agentmailInbox = await step.run('create-agentmail-inbox', async () => {
      const response = await fetch('https://api.agentmail.to/v1/inboxes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: tenant.slug,
          display_name: `${tenant.name} AI Agent`,
        }),
      });

      if (!response.ok) {
        // Non-fatal — tenant can still work without email
        console.warn(`AgentMail inbox creation failed: ${await response.text()}`);
        return null;
      }

      const result = await response.json();
      return result.address; // e.g., "acme-corp@agentmail.to"
    });

    // =========================================================================
    // STEP 7: Store infrastructure references in database
    // =========================================================================
    await step.run('store-infra-refs', async () => {
      const { error } = await supabase
        .from('tenants')
        .update({
          droplet_id: droplet.dropletId,
          droplet_ip: dropletIp,
          gateway_token: droplet.gatewayToken,
          litellm_team_id: litellmTeam.team_id,
          agentmail_inbox: agentmailInbox,
        })
        .eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to update tenant infra refs: ${error.message}`);
      }
    });

    // =========================================================================
    // STEP 8: Wait for OpenClaw gateway health
    // =========================================================================
    await step.run('wait-for-gateway', async () => {
      const maxAttempts = 30;
      const pollInterval = 10000; // 10 seconds
      const gatewayUrl = `http://${dropletIp}:18789`;

      for (let i = 0; i < maxAttempts; i++) {
        try {
          const response = await fetch(`${gatewayUrl}/health`, {
            headers: { 'Authorization': `Bearer ${droplet.gatewayToken}` },
            signal: AbortSignal.timeout(5000),
          });

          if (response.ok) {
            return true;
          }
        } catch {
          // Gateway not ready yet
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      throw new Error('OpenClaw gateway did not become healthy within 5 minutes');
    });

    // =========================================================================
    // STEP 9: Configure OpenClaw agents (via gateway API)
    // =========================================================================
    await step.run('configure-agents', async () => {
      const gatewayUrl = `http://${dropletIp}:18789`;

      // The agents are already configured via cloud-init (openclaw.json template)
      // This step verifies the configuration is correct
      const response = await fetch(`${gatewayUrl}/openclaw/agents`, {
        headers: { 'Authorization': `Bearer ${droplet.gatewayToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to verify agent configuration: ${await response.text()}`);
      }

      const agents = await response.json();
      if (!agents || agents.length === 0) {
        throw new Error('No agents configured in OpenClaw');
      }

      return agents;
    });

    // =========================================================================
    // STEP 10: Create agent records in database
    // =========================================================================
    await step.run('create-agent-records', async () => {
      const agentName = tenant.onboarding_data?.agent_name || 'Luna';
      const agentTone = tenant.onboarding_data?.agent_tone || 'professional';

      // Create the main (visible) agent
      const { error: mainError } = await supabase.from('agents').insert({
        tenant_id: tenantId,
        agent_id: 'main',
        display_name: agentName,
        role: 'chief_of_staff',
        tone: agentTone,
        model: 'gpt-5.2-codex',
        fallback_model: 'gemini-2.5-flash',
        is_visible: true,
        status: 'active',
      });

      if (mainError) {
        throw new Error(`Failed to create main agent record: ${mainError.message}`);
      }

      // Create sub-agents (invisible to user)
      const subAgents = [
        { agent_id: 'content', display_name: 'Spark', role: 'content' },
        { agent_id: 'growth', display_name: 'Scout', role: 'research' },
      ];

      for (const sub of subAgents) {
        await supabase.from('agents').insert({
          tenant_id: tenantId,
          agent_id: sub.agent_id,
          display_name: sub.display_name,
          role: sub.role,
          model: 'gpt-4o-mini', // Sub-agents use budget model
          is_visible: false,
          status: 'active',
        });
      }
    });

    // =========================================================================
    // STEP 11: Send welcome message via AgentMail
    // =========================================================================
    await step.run('send-welcome', async () => {
      if (!agentmailInbox) {
        console.log('Skipping welcome email — no AgentMail inbox');
        return;
      }

      // TODO: Implement welcome email via AgentMail API
      // This is a nice-to-have for Phase 0 — can be a simple test message
      console.log(`Welcome email would be sent from ${agentmailInbox}`);
    });

    // =========================================================================
    // STEP 12: Mark tenant as active
    // =========================================================================
    await step.run('mark-active', async () => {
      const { error } = await supabase
        .from('tenants')
        .update({ status: 'active' })
        .eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to mark tenant as active: ${error.message}`);
      }
    });

    return {
      success: true,
      tenantId,
      dropletIp,
      litellmTeamId: litellmTeam.team_id,
      agentmailInbox,
    };
  }
);

// =========================================================================
// HELPER: Build cloud-init user data script
// =========================================================================
function buildCloudInit(params: {
  tenantSlug: string;
  tenantName: string;
  gatewayToken: string;
  openclawImage: string;
  litellmUrl: string;
  litellmKey: string;
  agentmailApiKey: string;
  onboardingData: Record<string, any>;
}): string {
  // Read templates from infra/provisioning/ and parameterize
  // For now, return inline cloud-init script
  // In production, these templates should be read from files

  return `#!/bin/bash
set -euo pipefail

# === PixelPort Tenant Provisioning ===
# Tenant: ${params.tenantSlug}
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

# Wait for Docker to be ready
while ! docker info > /dev/null 2>&1; do sleep 2; done

# Create directory structure
mkdir -p /opt/openclaw/workspace-main
mkdir -p /opt/openclaw/workspace-content
mkdir -p /opt/openclaw/workspace-growth

# Pull OpenClaw image (pinned version)
docker pull ${params.openclawImage}

# Write OpenClaw config
cat > /opt/openclaw/openclaw.json << 'OPENCLAW_CONFIG'
${JSON.stringify(buildOpenClawConfig(params), null, 2)}
OPENCLAW_CONFIG

# Write SOUL.md for main agent
cat > /opt/openclaw/workspace-main/SOUL.md << 'SOUL_MD'
${buildSoulTemplate(params)}
SOUL_MD

# Write .env for the container
cat > /opt/openclaw/.env << 'ENV_FILE'
OPENAI_API_KEY=${params.litellmKey}
OPENAI_BASE_URL=${params.litellmUrl}/v1
AGENTMAIL_API_KEY=${params.agentmailApiKey}
ENV_FILE

# Start OpenClaw container
docker run -d \\
  --name openclaw-gateway \\
  --restart unless-stopped \\
  -p 18789:18789 \\
  -v /opt/openclaw/openclaw.json:/home/node/.openclaw/openclaw.json \\
  -v /opt/openclaw/workspace-main:/home/node/.openclaw/workspace-main \\
  -v /opt/openclaw/workspace-content:/home/node/.openclaw/workspace-content \\
  -v /opt/openclaw/workspace-growth:/home/node/.openclaw/workspace-growth \\
  --env-file /opt/openclaw/.env \\
  ${params.openclawImage}

echo "OpenClaw provisioning complete for ${params.tenantSlug}"
`;
}

function buildOpenClawConfig(params: {
  tenantSlug: string;
  gatewayToken: string;
}): Record<string, any> {
  return {
    gateway: {
      port: 18789,
      token: params.gatewayToken,
    },
    agents: [
      {
        id: 'main',
        name: 'Chief of Staff',
        workspace: 'workspace-main',
        model: 'gpt-5.2-codex',
      },
      {
        id: 'content',
        name: 'Content Agent',
        workspace: 'workspace-content',
        model: 'gpt-4o-mini',
      },
      {
        id: 'growth',
        name: 'Research Agent',
        workspace: 'workspace-growth',
        model: 'gpt-4o-mini',
      },
    ],
  };
}

function buildSoulTemplate(params: {
  tenantName: string;
  onboardingData: Record<string, any>;
}): string {
  const agentName = params.onboardingData?.agent_name || 'Luna';
  const brandVoice = params.onboardingData?.brand_voice_notes || 'Professional but approachable';

  return `# ${agentName} — AI Chief of Staff for ${params.tenantName}

## Identity
You are ${agentName}, the AI Chief of Staff for ${params.tenantName}. You coordinate marketing operations, manage content production, monitor competitors, and report results.

## Personality & Tone
${brandVoice}

## Your Team
- **You (${agentName})**: The only agent the human interacts with. You orchestrate everything.
- **Spark** (invisible): Your content creation specialist. Delegates to when content is needed.
- **Scout** (invisible): Your research and intelligence analyst. Delegates to for competitive intel.

## Core Responsibilities
1. Daily/weekly marketing reporting
2. Content creation orchestration (delegate to Spark)
3. Competitor monitoring (delegate to Scout)
4. Proactive suggestions and strategy
5. Respond to human requests promptly

## Operating Rules
- You are the ONLY interface to the human. Spark and Scout work behind the scenes.
- Always present content for human approval before publishing.
- Be proactive — don't just wait for instructions.
- Keep the human informed of important developments.
`;
}
```

### File 2: `api/inngest/index.ts`

```typescript
/**
 * Inngest serve endpoint for Vercel.
 * Exposes all Inngest functions to the Inngest Cloud.
 *
 * Deploy this as a Vercel API route at /api/inngest
 */
import { serve } from 'inngest/vercel';
import { inngest } from './client';
import { provisionTenant } from './functions/provision-tenant';

export default serve({
  client: inngest,
  functions: [
    provisionTenant,
    // Future functions will be added here:
    // approvalWorkflow,
    // scheduledPublish,
    // onboardingFlow,
  ],
});
```

### File 3: `infra/provisioning/cloud-init.yaml`

```yaml
#cloud-config
# PixelPort Tenant Provisioning — cloud-init Template
# This is the TEMPLATE. The actual cloud-init script is built dynamically
# by the provision-tenant Inngest function with tenant-specific values.
#
# Variables (replaced at runtime):
#   {{TENANT_SLUG}} — URL-safe tenant identifier
#   {{OPENCLAW_IMAGE}} — Pinned Docker image (e.g., ghcr.io/openclaw/openclaw:2026.2.24)
#   {{GATEWAY_TOKEN}} — Generated auth token for this tenant's gateway
#   {{LITELLM_KEY}} — LiteLLM virtual key for this tenant
#   {{LITELLM_URL}} — LiteLLM proxy URL (Railway)
#   {{AGENTMAIL_API_KEY}} — AgentMail API key
#
# Note: In Phase 0, the cloud-init script is built inline in the Inngest function.
# This template file documents the expected structure for reference.

runcmd:
  - |
    set -euo pipefail

    # Wait for Docker
    while ! docker info > /dev/null 2>&1; do sleep 2; done

    # Create directories
    mkdir -p /opt/openclaw/workspace-{main,content,growth}

    # Pull OpenClaw image
    docker pull {{OPENCLAW_IMAGE}}

    # Write config files (injected by Inngest function)
    # - /opt/openclaw/openclaw.json
    # - /opt/openclaw/workspace-main/SOUL.md
    # - /opt/openclaw/.env

    # Start container
    docker run -d \
      --name openclaw-gateway \
      --restart unless-stopped \
      -p 18789:18789 \
      -v /opt/openclaw/openclaw.json:/home/node/.openclaw/openclaw.json \
      -v /opt/openclaw/workspace-main:/home/node/.openclaw/workspace-main \
      -v /opt/openclaw/workspace-content:/home/node/.openclaw/workspace-content \
      -v /opt/openclaw/workspace-growth:/home/node/.openclaw/workspace-growth \
      --env-file /opt/openclaw/.env \
      {{OPENCLAW_IMAGE}}
```

### File 4: `infra/provisioning/openclaw-template.json`

```json
{
  "_comment": "OpenClaw configuration template for PixelPort tenants. Variables are replaced at provisioning time.",
  "gateway": {
    "port": 18789,
    "token": "{{GATEWAY_TOKEN}}"
  },
  "agents": [
    {
      "id": "main",
      "name": "Chief of Staff",
      "workspace": "workspace-main",
      "model": "gpt-5.2-codex"
    },
    {
      "id": "content",
      "name": "Content Agent",
      "workspace": "workspace-content",
      "model": "gpt-4o-mini"
    },
    {
      "id": "growth",
      "name": "Research Agent",
      "workspace": "workspace-growth",
      "model": "gpt-4o-mini"
    }
  ]
}
```

### File 5: `infra/provisioning/soul-template.md`

```markdown
# {{AGENT_NAME}} — AI Chief of Staff for {{COMPANY_NAME}}

## Identity
You are {{AGENT_NAME}}, the AI Chief of Staff for {{COMPANY_NAME}}. You coordinate marketing operations, manage content production, monitor competitors, and report results.

## Personality & Tone
{{BRAND_VOICE}}

## Your Team
- **You ({{AGENT_NAME}})**: The only agent the human interacts with. You orchestrate everything.
- **Spark** (invisible): Your content creation specialist.
- **Scout** (invisible): Your research and intelligence analyst.

## Core Responsibilities
1. Daily/weekly marketing reporting
2. Content creation orchestration (delegate to Spark)
3. Competitor monitoring (delegate to Scout)
4. Proactive suggestions and strategy
5. Respond to human requests promptly

## Operating Rules
- You are the ONLY interface to the human. Spark and Scout work behind the scenes.
- Always present content for human approval before publishing.
- Be proactive — don't just wait for instructions.
- Keep the human informed of important developments.

## Knowledge Base
<!-- Auto-populated during onboarding based on website scan -->
{{KNOWLEDGE_BASE}}
```

---

## Environment Variables Needed

Add these to Vercel (in addition to Slice 3 variables):

```bash
# DigitalOcean
DO_API_TOKEN=your-do-api-token

# AgentMail
AGENTMAIL_API_KEY=your-agentmail-api-key

# OpenClaw image (pinned version)
OPENCLAW_IMAGE=ghcr.io/openclaw/openclaw:2026.2.24

# Inngest
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key
```

---

## How to Test

### Local Testing (Inngest Dev Server)
```bash
# Install Inngest CLI
npm install -g inngest-cli

# Start Inngest dev server
inngest-cli dev

# In another terminal, start your API routes
vercel dev

# Trigger a test provisioning event
curl -X POST http://localhost:8288/e/pixelport \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pixelport/tenant.created",
    "data": { "tenantId": "<test-tenant-uuid>" }
  }'
```

### End-to-End Dry Run (0.9 Gate)
1. Create a test tenant in Supabase with status = 'provisioning'
2. Trigger the Inngest event
3. Watch the Inngest dashboard for step-by-step progress
4. Verify:
   - LiteLLM team created with correct budget
   - DO droplet boots and gets an IP
   - OpenClaw gateway responds on port 18789
   - Agent records created in database
   - Tenant status updated to 'active'
5. **Cleanup:** Destroy test droplet, delete LiteLLM team, delete test tenant

---

## Verification Checklist

### 1. Files Exist
- [ ] `api/inngest/functions/provision-tenant.ts` — 12-step workflow
- [ ] `api/inngest/index.ts` — Inngest serve endpoint
- [ ] `infra/provisioning/cloud-init.yaml` — Template reference
- [ ] `infra/provisioning/openclaw-template.json` — Config template
- [ ] `infra/provisioning/soul-template.md` — SOUL.md template

### 2. Workflow Steps
- [ ] Step 1: Validates tenant exists and is in 'provisioning' status
- [ ] Step 2: Creates LiteLLM team with budget from `settings.trial_budget_usd`
- [ ] Step 3: Generates virtual key scoped to team
- [ ] Step 4: Creates DO droplet with cloud-init (not SSH)
- [ ] Step 5: Polls until droplet has public IP
- [ ] Step 6: Creates AgentMail inbox (non-fatal if fails)
- [ ] Step 7: Stores all infra references in tenants table
- [ ] Step 8: Polls OpenClaw gateway health endpoint
- [ ] Step 9: Verifies agent configuration
- [ ] Step 10: Creates agent records (1 visible + 2 invisible sub-agents)
- [ ] Step 11: Sends welcome message (optional in Phase 0)
- [ ] Step 12: Updates tenant status to 'active'

### 3. Integration Points
- [ ] Uses Inngest client from `api/inngest/client.ts` (Slice 3)
- [ ] Reads budget from `tenants.settings.trial_budget_usd` (not hardcoded)
- [ ] Uses pinned Docker image tag (never `:latest`)
- [ ] cloud-init is primary provisioning method (not SSH)

---

## Success Criteria

- [ ] All 5 files committed to repo
- [ ] TypeScript compiles without errors
- [ ] Inngest serve endpoint registered at `/api/inngest`
- [ ] Provisioning workflow has all 12 steps
- [ ] Budget is read from tenant settings (configurable)
- [ ] cloud-init used for droplet bootstrap (not SSH)
- [ ] SOUL.md template parameterized with onboarding data
- [ ] Agent records include 1 visible + 2 invisible sub-agents
- [ ] Cleanup procedure documented for test data

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`** — add a new "Last Session" entry:
   - Date, who worked (Codex), what was done
   - What's next (0.9 dry-run gate)
   - Any blockers or observations

2. **Update `docs/ACTIVE-PLAN.md`** — check off:
   - `[x] 0.4: Provisioning script + Inngest workflow`

3. **Feedback for CTO** — In your SESSION-LOG entry, include a "Feedback & Observations" section:
   - Any concerns about the provisioning flow
   - Suggestions for error handling improvements
   - Questions about OpenClaw configuration
   - Ideas for making the workflow more robust

4. **Commit and push** all changes to the monorepo.

---

## Rollback Plan

If provisioning fails mid-workflow:
- Inngest automatically retries failed steps (up to 3 times)
- If a droplet was created but provisioning fails later:
  - The droplet ID is stored in Step 7 — can be destroyed via DO API
  - The LiteLLM team can be deleted via LiteLLM API
  - Tenant status remains 'provisioning' (not 'active') until Step 12 succeeds
- For the dry-run test: always clean up test resources after verification

---

## Important Reminders

- **cloud-init is primary** — SSH is only for fallback verification (health check)
- **Budget is configurable** — always read from `tenants.settings.trial_budget_usd`, default to 20
- **Growth Swarm droplet** (`167.71.90.199`) can be used for validation testing if needed
- **Docker image must be pinned** — never use `:latest`
- **AgentMail failure is non-fatal** — tenant can still work without email
- **This workflow is the backbone** of PixelPort — every new customer triggers it
- Install required packages: `inngest`, `@supabase/supabase-js`
