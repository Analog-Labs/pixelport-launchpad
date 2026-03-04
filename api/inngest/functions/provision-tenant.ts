import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '../client';

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
const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:2026.2.24';

if (!LITELLM_URL || !LITELLM_MASTER_KEY || !DO_API_TOKEN) {
  throw new Error('Missing one or more required env vars: LITELLM_URL, LITELLM_MASTER_KEY, DO_API_TOKEN');
}

const DEFAULT_DROPLET_SIZE = 's-1vcpu-1gb';
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
          team_alias: `pixelport-${tenant.slug}`,
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
          key_alias: `pixelport-${tenant.slug}-main`,
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

      const response = await fetch('https://api.digitalocean.com/v2/droplets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `pixelport-${tenant.slug}`,
          region: requestedRegion,
          size: requestedSize,
          image: 'ubuntu-24-04-x64',
          user_data: cloudInit,
          tags: ['pixelport', `tenant-${tenant.slug}`, 'pixelport-trial'],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Droplet creation failed (HTTP ${response.status}): ${errorBody} ` +
          `[size=${requestedSize}, region=${requestedRegion}, image=ubuntu-24-04-x64]`
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

    const dropletIp = await step.run('wait-for-droplet', async () => {
      const maxAttempts = 30;
      const pollIntervalMs = 10_000;

      for (let i = 0; i < maxAttempts; i += 1) {
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
            return publicIp;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      throw new Error('Droplet did not become ready within 5 minutes');
    });

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

    await step.run('wait-for-gateway', async () => {
      const maxAttempts = 30;
      const pollIntervalMs = 10_000;
      const gatewayUrl = `http://${dropletIp}:18789`;

      for (let i = 0; i < maxAttempts; i += 1) {
        try {
          const response = await fetch(`${gatewayUrl}/health`, {
            headers: { Authorization: `Bearer ${droplet.gatewayToken}` },
            signal: AbortSignal.timeout(5_000),
          });

          if (response.ok) {
            return true;
          }
        } catch {
          // not ready yet
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      throw new Error('OpenClaw gateway did not become healthy within 5 minutes');
    });

    await step.run('configure-agents', async () => {
      const gatewayUrl = `http://${dropletIp}:18789`;

      const response = await fetch(`${gatewayUrl}/openclaw/agents`, {
        headers: { Authorization: `Bearer ${droplet.gatewayToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to verify agent configuration: ${await response.text()}`);
      }

      const agents = (await response.json()) as unknown[];
      if (!agents || agents.length === 0) {
        throw new Error('No agents configured in OpenClaw');
      }

      return agents;
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

# PixelPort Tenant Provisioning
# Tenant: ${params.tenantSlug}
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

# Install Docker on plain Ubuntu 24.04
if ! command -v docker &> /dev/null; then
  apt-get update -y
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \$VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io
  systemctl enable docker
  systemctl start docker
fi

while ! docker info > /dev/null 2>&1; do sleep 2; done

mkdir -p /opt/openclaw/workspace-main
mkdir -p /opt/openclaw/workspace-content
mkdir -p /opt/openclaw/workspace-growth

docker pull ${params.openclawImage}

cat > /opt/openclaw/openclaw.json << 'OPENCLAW_CONFIG'
${JSON.stringify(buildOpenClawConfig(params), null, 2)}
OPENCLAW_CONFIG

cat > /opt/openclaw/workspace-main/SOUL.md << 'SOUL_MD'
${buildSoulTemplate(params)}
SOUL_MD

cat > /opt/openclaw/.env << 'ENV_FILE'
OPENAI_API_KEY=${params.litellmKey}
OPENAI_BASE_URL=${params.litellmUrl}/v1
AGENTMAIL_API_KEY=${params.agentmailApiKey}
ENV_FILE

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

function buildOpenClawConfig(params: { tenantSlug: string; gatewayToken: string }): Record<string, unknown> {
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
    metadata: {
      tenant_slug: params.tenantSlug,
    },
  };
}

function buildSoulTemplate(params: { tenantName: string; onboardingData: Json }): string {
  const agentName = (params.onboardingData.agent_name as string) || 'Luna';
  const brandVoice = (params.onboardingData.brand_voice_notes as string) || 'Professional but approachable';

  return `# ${agentName} — AI Chief of Staff for ${params.tenantName}

## Identity
You are ${agentName}, the AI Chief of Staff for ${params.tenantName}. You coordinate marketing operations, manage content production, monitor competitors, and report results.

## Personality & Tone
${brandVoice}

## Your Team
- **You (${agentName})**: The only agent the human interacts with. You orchestrate everything.
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
- Be proactive — do not just wait for instructions.
- Keep the human informed of important developments.
`;
}
