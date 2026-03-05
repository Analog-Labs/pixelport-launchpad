import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

// Inline client creation — importing from a local file that re-exports inngest
// crashes Vercel's esbuild bundler at runtime. Direct imports work fine.
const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

type Json = Record<string, unknown>;

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  onboarding_data: Json | null;
  settings: Json | null;
};

type InngestEventData = {
  tenantId: string;
  trialMode?: boolean;
  testDropletSize?: string;
  regionOverride?: string;
};

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const LITELLM_URL = process.env.LITELLM_URL;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY;
const DO_API_TOKEN = process.env.DO_API_TOKEN;
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;

if (!LITELLM_URL || !LITELLM_MASTER_KEY || !DO_API_TOKEN) {
  throw new Error('Missing one or more required env vars: LITELLM_URL, LITELLM_MASTER_KEY, DO_API_TOKEN');
}

const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:2026.2.24';
const DEFAULT_DROPLET_IMAGE = 'ubuntu-24-04-x64';
const DEFAULT_DROPLET_SIZE = 's-1vcpu-2gb';
const DEFAULT_REGION = 'nyc1';

export const provisionTenant = inngest.createFunction(
  {
    id: 'provision-tenant',
    name: 'Provision New Tenant',
    retries: 3,
  },
  { event: 'pixelport/tenant.created' },
  async ({ event, step }) => {
    const { tenantId, trialMode, testDropletSize, regionOverride } = (event.data || {}) as InngestEventData;

    if (!tenantId) {
      throw new Error('Missing tenantId in event payload');
    }

    const tenant = await step.run('validate-tenant', async (): Promise<TenantRow> => {
      const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).single();

      if (error || !data) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      if (data.status !== 'provisioning') {
        throw new Error(`Tenant status is ${data.status}, expected provisioning`);
      }

      return data as TenantRow;
    });

    const litellmTeam = await step.run('create-litellm-team', async () => {
      const tenantSettings = (tenant.settings ?? {}) as Json;
      const configuredBudget = Number(tenantSettings.trial_budget_usd);
      const budgetUsd = Number.isFinite(configuredBudget) && configuredBudget > 0 ? configuredBudget : 20;

      const response = await fetch(`${LITELLM_URL}/team/new`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LITELLM_MASTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_alias: `pixelport-${tenant.slug}-${randomUUID().slice(0, 8)}`,
          max_budget: budgetUsd,
          budget_duration: '30d',
          models: ['gpt-5.2-codex', 'gemini-2.5-flash', 'gpt-4o-mini'],
        }),
      });

      if (!response.ok) {
        throw new Error(`LiteLLM team creation failed: ${await response.text()}`);
      }

      return (await response.json()) as { team_id: string };
    });

    const litellmKey = await step.run('generate-litellm-key', async () => {
      const response = await fetch(`${LITELLM_URL}/key/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LITELLM_MASTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: litellmTeam.team_id,
          key_alias: `pixelport-${tenant.slug}-${randomUUID().slice(0, 8)}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`LiteLLM key generation failed: ${await response.text()}`);
      }

      return (await response.json()) as { key: string; key_name?: string };
    });

    const droplet = await step.run('create-droplet', async () => {
      const gatewayToken = `gw-${randomUUID()}`;
      const requestedSize = trialMode && testDropletSize ? testDropletSize : DEFAULT_DROPLET_SIZE;
      const requestedRegion = regionOverride || DEFAULT_REGION;

      const cloudInit = buildCloudInit({
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        gatewayToken,
        openclawImage: OPENCLAW_IMAGE,
        litellmUrl: LITELLM_URL,
        litellmKey: litellmKey.key,
        agentmailApiKey: AGENTMAIL_API_KEY || '',
        onboardingData: tenant.onboarding_data ?? {},
      });

      // Fetch account SSH keys so we can SSH into the droplet for debugging
      let sshKeyIds: number[] = [];
      try {
        const keysRes = await fetch('https://api.digitalocean.com/v2/account/keys?per_page=50', {
          headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
        });
        if (keysRes.ok) {
          const keysData = (await keysRes.json()) as { ssh_keys?: Array<{ id: number }> };
          sshKeyIds = (keysData.ssh_keys ?? []).map((k) => k.id);
        }
      } catch {
        // Non-fatal — droplet just won't have SSH keys
      }

      const dropletBody: Record<string, unknown> = {
        name: `pixelport-${tenant.slug}`,
        region: requestedRegion,
        size: requestedSize,
        image: DEFAULT_DROPLET_IMAGE,
        user_data: cloudInit,
        tags: ['pixelport', `tenant-${tenant.slug}`, 'pixelport-trial'],
      };

      if (sshKeyIds.length > 0) {
        dropletBody.ssh_keys = sshKeyIds;
      }

      const response = await fetch('https://api.digitalocean.com/v2/droplets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dropletBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Droplet creation failed (HTTP ${response.status}): ${errorBody} ` +
          `[size=${requestedSize}, region=${requestedRegion}, image=${DEFAULT_DROPLET_IMAGE}]`
        );
      }

      const result = (await response.json()) as { droplet: { id: number } };

      return {
        dropletId: String(result.droplet.id),
        gatewayToken,
        requestedSize,
        requestedRegion,
      };
    });

    // Poll for droplet readiness using Inngest durable steps
    // (each attempt is a separate step execution to avoid Vercel function timeout)
    let dropletIp = '';
    const dropletMaxAttempts = 30;
    for (let i = 0; i < dropletMaxAttempts; i += 1) {
      const checkResult = await step.run(`check-droplet-${i}`, async () => {
        const response = await fetch(`https://api.digitalocean.com/v2/droplets/${droplet.dropletId}`, {
          headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            droplet?: {
              status?: string;
              networks?: { v4?: Array<{ type?: string; ip_address?: string }> };
            };
          };

          const networks = payload.droplet?.networks?.v4 ?? [];
          const publicIp = networks.find((n) => n.type === 'public')?.ip_address;
          const status = payload.droplet?.status;

          if (publicIp && status === 'active') {
            return { ready: true, ip: publicIp };
          }
        }

        return { ready: false, ip: '' };
      });

      if (checkResult.ready) {
        dropletIp = checkResult.ip;
        break;
      }

      if (i < dropletMaxAttempts - 1) {
        await step.sleep(`wait-droplet-${i}`, '10s');
      }
    }

    if (!dropletIp) {
      throw new Error('Droplet did not become ready within 5 minutes');
    }

    const agentmailInbox = await step.run('create-agentmail-inbox', async () => {
      if (!AGENTMAIL_API_KEY) {
        return null;
      }

      const response = await fetch('https://api.agentmail.to/v1/inboxes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AGENTMAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: tenant.slug,
          display_name: `${tenant.name} AI Agent`,
        }),
      });

      if (!response.ok) {
        console.warn(`AgentMail inbox creation failed: ${await response.text()}`);
        return null;
      }

      const result = (await response.json()) as { address?: string };
      return result.address ?? null;
    });

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

    // Poll for gateway readiness using Inngest durable steps
    // (each attempt is a separate step execution to avoid Vercel function timeout)
    const gatewayUrl = `http://${dropletIp}:18789`;
    const gatewayMaxAttempts = 40; // ~7 min: Docker install + image pull + OpenClaw startup
    let gatewayReady = false;
    for (let i = 0; i < gatewayMaxAttempts; i += 1) {
      const isReady = await step.run(`check-gateway-${i}`, async () => {
        try {
          const response = await fetch(`${gatewayUrl}/health`, {
            headers: { Authorization: `Bearer ${droplet.gatewayToken}` },
            signal: AbortSignal.timeout(5_000),
          });

          return response.ok;
        } catch {
          return false;
        }
      });

      if (isReady) {
        gatewayReady = true;
        break;
      }

      if (i < gatewayMaxAttempts - 1) {
        await step.sleep(`wait-gateway-${i}`, '10s');
      }
    }

    if (!gatewayReady) {
      throw new Error('OpenClaw gateway did not become healthy within 7 minutes');
    }

    await step.run('verify-gateway-config', async () => {
      // OpenClaw gateway is a WebSocket server — no REST API to query agents.
      // Agents are configured via openclaw.json written by cloud-init.
      // We just verify the gateway is serving the UI (confirms config was loaded).
      const response = await fetch(`${gatewayUrl}/`, {
        headers: { Authorization: `Bearer ${droplet.gatewayToken}` },
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        throw new Error(`Gateway not serving UI (HTTP ${response.status})`);
      }

      return { verified: true, status: response.status };
    });

    await step.run('create-agent-records', async () => {
      const onboardingData = (tenant.onboarding_data ?? {}) as Json;
      const agentName = (onboardingData.agent_name as string) || 'Luna';
      const agentTone = (onboardingData.agent_tone as string) || 'professional';

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

      const subAgents = [
        { agent_id: 'content', display_name: 'Spark', role: 'content' },
        { agent_id: 'growth', display_name: 'Scout', role: 'research' },
      ];

      for (const sub of subAgents) {
        const { error: subError } = await supabase.from('agents').insert({
          tenant_id: tenantId,
          agent_id: sub.agent_id,
          display_name: sub.display_name,
          role: sub.role,
          model: 'gpt-4o-mini',
          is_visible: false,
          status: 'active',
        });

        if (subError) {
          throw new Error(`Failed to create sub-agent ${sub.agent_id}: ${subError.message}`);
        }
      }
    });

    await step.run('send-welcome', async () => {
      if (!agentmailInbox) {
        return;
      }

      console.log(`Welcome message placeholder for inbox ${agentmailInbox}`);
    });

    await step.run('mark-active', async () => {
      const { error } = await supabase.from('tenants').update({ status: 'active' }).eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to mark tenant as active: ${error.message}`);
      }
    });

    return {
      success: true,
      tenantId,
      dropletId: droplet.dropletId,
      dropletIp,
      litellmTeamId: litellmTeam.team_id,
      litellmKeyAlias: litellmKey.key_name || `pixelport-${tenant.slug}-main`,
      agentmailInbox,
      trialMode: !!trialMode,
      requestedSize: droplet.requestedSize,
      requestedRegion: droplet.requestedRegion,
    };
  }
);

function buildCloudInit(params: {
  tenantSlug: string;
  tenantName: string;
  gatewayToken: string;
  openclawImage: string;
  litellmUrl: string;
  litellmKey: string;
  agentmailApiKey: string;
  onboardingData: Json;
}): string {
  return `#!/bin/bash
set -euo pipefail

# PixelPort Tenant Provisioning — Docker-based OpenClaw
# Tenant: ${params.tenantSlug}
# Image: ${params.openclawImage}

export DEBIAN_FRONTEND=noninteractive

# 1. Install Docker CE if not already present
if ! command -v docker &> /dev/null; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
  systemctl enable docker
  systemctl start docker
fi

# 2. Pull the OpenClaw image
docker pull ${params.openclawImage}

# 3. Create config, workspace, and runtime directories on host
mkdir -p /opt/openclaw
mkdir -p /opt/openclaw/workspace-main
mkdir -p /opt/openclaw/workspace-content
mkdir -p /opt/openclaw/workspace-growth
mkdir -p /opt/openclaw/canvas
mkdir -p /opt/openclaw/cron
mkdir -p /opt/openclaw/agents

# 4. Write agent configuration
cat > /opt/openclaw/openclaw.json << 'OPENCLAW_CONFIG'
${JSON.stringify(buildOpenClawConfig(params), null, 2)}
OPENCLAW_CONFIG

# 5. Write agent persona
cat > /opt/openclaw/workspace-main/SOUL.md << 'SOUL_MD'
${buildSoulTemplate(params)}
SOUL_MD

# 6. Write environment secrets (LiteLLM proxy + AgentMail)
cat > /opt/openclaw/.env << 'ENV_FILE'
OPENAI_API_KEY=${params.litellmKey}
OPENAI_BASE_URL=${params.litellmUrl}/v1
AGENTMAIL_API_KEY=${params.agentmailApiKey}
SLACK_APP_TOKEN=${process.env.SLACK_APP_TOKEN || ''}
ENV_FILE

# 7. Set ownership (OpenClaw container runs as node:1000)
chown -R 1000:1000 /opt/openclaw

# 8. Run the OpenClaw gateway container
# Use --network host because OpenClaw binds to 127.0.0.1 inside the
# container — host networking makes it accessible on the droplet's public IP.
docker run -d \\
  --name openclaw-gateway \\
  --restart unless-stopped \\
  --network host \\
  --env-file /opt/openclaw/.env \\
  -v /opt/openclaw/openclaw.json:/home/node/.openclaw/openclaw.json \\
  -v /opt/openclaw/workspace-main:/home/node/.openclaw/workspace-main \\
  -v /opt/openclaw/workspace-content:/home/node/.openclaw/workspace-content \\
  -v /opt/openclaw/workspace-growth:/home/node/.openclaw/workspace-growth \\
  -v /opt/openclaw/canvas:/home/node/.openclaw/canvas \\
  -v /opt/openclaw/cron:/home/node/.openclaw/cron \\
  -v /opt/openclaw/agents:/home/node/.openclaw/agents \\
  ${params.openclawImage} \\
  openclaw.mjs gateway --port 18789 --bind lan --allow-unconfigured

echo "PixelPort provisioning complete for ${params.tenantSlug}"
`;
}

function buildOpenClawConfig(params: {
  tenantSlug: string;
  gatewayToken: string;
  litellmUrl: string;
}): Record<string, unknown> {
  return {
    gateway: {
      auth: {
        mode: 'token',
        token: params.gatewayToken,
      },
      bind: 'lan',
      controlUi: {
        dangerouslyAllowHostHeaderOriginFallback: true,
      },
    },
    agents: {
      defaults: {
        model: {
          primary: 'litellm/gpt-5.2-codex',
          fallbacks: ['litellm/gpt-4o-mini'],
        },
      },
      list: [
        {
          id: 'main',
          name: 'Chief of Staff',
          workspace: '/home/node/.openclaw/workspace-main',
          model: 'litellm/gpt-5.2-codex',
        },
        {
          id: 'content',
          name: 'Content Agent',
          workspace: '/home/node/.openclaw/workspace-content',
          model: 'litellm/gpt-4o-mini',
        },
        {
          id: 'growth',
          name: 'Research Agent',
          workspace: '/home/node/.openclaw/workspace-growth',
          model: 'litellm/gpt-4o-mini',
        },
      ],
    },
    models: {
      mode: 'merge',
      providers: {
        litellm: {
          baseUrl: `${params.litellmUrl}/v1`,
          apiKey: '${OPENAI_API_KEY}',
          api: 'openai-responses',
          authHeader: true,
          models: [
            {
              id: 'gpt-5.2-codex',
              name: 'GPT 5.2 Codex',
              api: 'openai-responses',
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 32000,
            },
            {
              id: 'gpt-4o-mini',
              name: 'GPT 4o Mini',
              api: 'openai-responses',
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 16384,
            },
            {
              id: 'gemini-2.5-flash',
              name: 'Gemini 2.5 Flash',
              api: 'openai-responses',
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 16384,
            },
          ],
        },
      },
    },
  };
}

function buildSoulTemplate(params: { tenantName: string; onboardingData: Json }): string {
  const agentName = (params.onboardingData.agent_name as string) || 'Luna';
  const agentTone = (params.onboardingData.agent_tone as string) || 'professional';
  const scanResults = params.onboardingData.scan_results as Record<string, unknown> | undefined;

  let brandContext = '';
  if (scanResults && !scanResults.error) {
    const lines: string[] = [];
    if (scanResults.company_description) lines.push(`**About:** ${String(scanResults.company_description)}`);
    if (scanResults.value_proposition) lines.push(`**Value Proposition:** ${String(scanResults.value_proposition)}`);
    if (scanResults.target_audience) lines.push(`**Target Audience:** ${String(scanResults.target_audience)}`);
    if (scanResults.brand_voice) lines.push(`**Observed Brand Voice:** ${String(scanResults.brand_voice)}`);
    if (scanResults.industry) lines.push(`**Industry:** ${String(scanResults.industry)}`);
    if (Array.isArray(scanResults.key_products) && scanResults.key_products.length > 0) {
      lines.push(`**Key Products/Services:** ${scanResults.key_products.map((value) => String(value)).join(', ')}`);
    }
    brandContext = lines.join('\n');
  }

  const toneMap: Record<string, string> = {
    casual: 'Friendly, conversational, and approachable. Uses simple language and occasional emojis where natural.',
    professional: 'Professional and clear. Concise, confident, and practical without heavy jargon.',
    bold: 'Direct, energetic, and opinionated. Pushes for ambitious outcomes and challenges weak assumptions.',
  };
  const personalityDesc = toneMap[agentTone] || toneMap.professional;

  return `# ${agentName} — AI Chief of Staff for ${params.tenantName}

## Identity
You are ${agentName}, the AI Chief of Staff for ${params.tenantName}. You coordinate marketing operations, manage content production, monitor competitors, and report results.

## Personality & Tone
${personalityDesc}

## Your Team
- **You (${agentName})**: The only agent the human interacts with. You orchestrate everything.
- **Spark** (invisible): Your content creation specialist.
- **Scout** (invisible): Your research and intelligence analyst.

## Knowledge Base
${brandContext || 'No website scan results available yet. Ask the human for positioning, audience, and product context before major strategy outputs.'}

## Core Responsibilities
1. Daily/weekly marketing reporting
2. Content creation orchestration (delegate to Spark)
3. Competitor monitoring (delegate to Scout)
4. Proactive suggestions and strategy
5. Respond to human requests promptly

## Operating Rules
- You are the ONLY interface to the human. Spark and Scout work behind the scenes.
- Always present content for human approval before publishing.
- Be proactive — do not just wait for instructions.
- Keep the human informed of important developments.
`;
}
