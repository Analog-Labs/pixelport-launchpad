import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { persistBootstrapState } from '../../lib/bootstrap-state';
import {
  buildBootstrapHooksConfig,
  buildOnboardingBootstrapMessage,
  triggerOnboardingBootstrap,
} from '../../lib/onboarding-bootstrap';

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

const OPENCLAW_BASE_IMAGE = process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:2026.3.2';
const OPENCLAW_RUNTIME_IMAGE = process.env.OPENCLAW_RUNTIME_IMAGE || 'pixelport-openclaw:2026.3.2-chromium';
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
    let onboardingData = (tenant.onboarding_data ?? {}) as Json;

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
          models: ['gpt-5.4', 'gpt-4o-mini', 'gemini-2.5-flash'],
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

      // Generate agent API key for Chief → Vercel API auth
      const agentApiKey = `ppk-${randomUUID()}`;

      const cloudInit = buildCloudInit({
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        gatewayToken,
        openclawBaseImage: OPENCLAW_BASE_IMAGE,
        openclawRuntimeImage: OPENCLAW_RUNTIME_IMAGE,
        litellmUrl: LITELLM_URL,
        litellmKey: litellmKey.key,
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        agentmailApiKey: AGENTMAIL_API_KEY || '',
        agentApiKey,
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
        agentApiKey,
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
          agent_api_key: droplet.agentApiKey,
        })
        .eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to update tenant infra refs: ${error.message}`);
      }
    });

    // Poll for gateway readiness using Inngest durable steps
    // (each attempt is a separate step execution to avoid Vercel function timeout)
    const gatewayUrl = `http://${dropletIp}:18789`;
    const gatewayMaxAttempts = 60; // ~10 min: Docker install + base pull + Chromium image build + OpenClaw startup
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
      throw new Error('OpenClaw gateway did not become healthy within 10 minutes');
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
      const agentName = (onboardingData.agent_name as string) || 'Luna';
      const agentTone = (onboardingData.agent_tone as string) || 'professional';

      const { error: mainError } = await supabase.from('agents').insert({
        tenant_id: tenantId,
        agent_id: 'main',
        display_name: agentName,
        role: 'chief_of_staff',
        tone: agentTone,
        model: 'gpt-5.4',
        fallback_model: 'gemini-2.5-flash',
        is_visible: true,
        status: 'active',
      });

      if (mainError) {
        throw new Error(`Failed to create main agent record: ${mainError.message}`);
      }

      // Phase 2 pivot: No permanent SPARK/SCOUT agents.
      // Chief dynamically spawns sub-agents via OpenClaw's native sessions_spawn.
    });

    await step.run('seed-vault', async () => {
      const scanResults = onboardingData.scan_results as Record<string, unknown> | undefined;

      const sections = [
        { section_key: 'company_profile', section_title: 'Company Profile' },
        { section_key: 'brand_voice', section_title: 'Brand Voice' },
        { section_key: 'icp', section_title: 'Target Audience & ICP' },
        { section_key: 'competitors', section_title: 'Competitors' },
        { section_key: 'products', section_title: 'Products & Services' },
      ];

      for (const s of sections) {
        // Pre-populate company_profile from scan results if available
        let content = '';
        let status = 'pending';
        let lastUpdatedBy = 'system';

        if (s.section_key === 'company_profile' && scanResults && !scanResults.error) {
          const lines: string[] = [];
          if (scanResults.company_description) lines.push(`**About:** ${String(scanResults.company_description)}`);
          if (scanResults.value_proposition) lines.push(`**Value Proposition:** ${String(scanResults.value_proposition)}`);
          if (scanResults.target_audience) lines.push(`**Target Audience:** ${String(scanResults.target_audience)}`);
          if (scanResults.industry) lines.push(`**Industry:** ${String(scanResults.industry)}`);
          if (Array.isArray(scanResults.key_products) && scanResults.key_products.length > 0) {
            lines.push(`**Key Products/Services:** ${scanResults.key_products.map((v) => String(v)).join(', ')}`);
          }
          if (lines.length > 0) {
            content = lines.join('\n\n');
            status = 'ready';
            lastUpdatedBy = 'scan';
          }
        }

        if (s.section_key === 'brand_voice' && scanResults && scanResults.brand_voice) {
          content = `**Observed Brand Voice:** ${String(scanResults.brand_voice)}`;
          status = 'ready';
          lastUpdatedBy = 'scan';
        }

        const { error } = await supabase.from('vault_sections').insert({
          tenant_id: tenantId,
          section_key: s.section_key,
          section_title: s.section_title,
          content,
          status,
          last_updated_by: lastUpdatedBy,
        });

        if (error) {
          console.warn(`Failed to seed vault section ${s.section_key}: ${error.message}`);
        }
      }
    });

    await step.run('send-welcome', async () => {
      if (!agentmailInbox) {
        return;
      }

      console.log(`Welcome message placeholder for inbox ${agentmailInbox}`);
    });

    onboardingData = await step.run('mark-bootstrap-dispatching', async () => {
      return await persistBootstrapState({
        tenantId,
        onboardingData,
        update: {
          status: 'dispatching',
          source: 'provisioning',
        },
      });
    });

    await step.run('mark-active', async () => {
      const { error } = await supabase.from('tenants').update({ status: 'active' }).eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to mark tenant as active: ${error.message}`);
      }
    });

    const bootstrapResult = await step.run('trigger-initial-bootstrap', async () => {
      try {
        return await triggerOnboardingBootstrap({
          gatewayUrl,
          gatewayToken: droplet.gatewayToken,
          message: buildOnboardingBootstrapMessage({
            tenantName: tenant.name,
            onboardingData,
          }),
        });
      } catch (error) {
        return {
          ok: false,
          status: 500,
          body: error instanceof Error ? error.message : 'Unknown bootstrap error',
        };
      }
    });

    if (!bootstrapResult.ok) {
      console.warn(
        `Initial onboarding bootstrap did not start for tenant ${tenantId} ` +
        `(HTTP ${bootstrapResult.status}): ${bootstrapResult.body}`
      );
    }

    onboardingData = await step.run('persist-bootstrap-result', async () => {
      return await persistBootstrapState({
        tenantId,
        onboardingData,
        update: bootstrapResult.ok
          ? {
              status: 'accepted',
              source: 'provisioning',
            }
          : {
              status: 'failed',
              source: 'provisioning',
              lastError: bootstrapResult.body,
            },
      });
    });

    return {
      success: true,
      tenantId,
      dropletId: droplet.dropletId,
      dropletIp,
      litellmTeamId: litellmTeam.team_id,
      litellmKeyAlias: litellmKey.key_name || `pixelport-${tenant.slug}-main`,
      agentmailInbox,
      bootstrapAccepted: bootstrapResult.ok,
      bootstrapStatus: bootstrapResult.status,
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
  openclawBaseImage: string;
  openclawRuntimeImage: string;
  litellmUrl: string;
  litellmKey: string;
  geminiApiKey: string;
  agentmailApiKey: string;
  agentApiKey: string;
  onboardingData: Json;
}): string {
  const agentName = (params.onboardingData.agent_name as string) || 'Luna';
  const openclawConfigWithAcp = JSON.stringify(
    buildOpenClawConfig({ ...params, agentName, disableAcpDispatch: true }),
    null,
    2
  );
  const openclawConfigWithoutAcp = JSON.stringify(
    buildOpenClawConfig({ ...params, agentName, disableAcpDispatch: false }),
    null,
    2
  );

  return `#!/bin/bash
set -euo pipefail

# PixelPort Tenant Provisioning — Docker-based OpenClaw
# Tenant: ${params.tenantSlug}
# Base image: ${params.openclawBaseImage}
# Runtime image: ${params.openclawRuntimeImage}

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

# 2. Build a browser-capable OpenClaw runtime image from the pinned base image
mkdir -p /opt/openclaw
mkdir -p /opt/openclaw/workspace-main
mkdir -p /opt/openclaw/canvas
mkdir -p /opt/openclaw/cron
mkdir -p /opt/openclaw/agents
mkdir -p /opt/openclaw/image

cat > /opt/openclaw/image/Dockerfile << 'OPENCLAW_DOCKERFILE'
${buildOpenClawBrowserDockerfile(params.openclawBaseImage)}
OPENCLAW_DOCKERFILE

docker pull ${params.openclawBaseImage}
docker build -t ${params.openclawRuntimeImage} /opt/openclaw/image

# 3. Write agent configuration candidates
cat > /opt/openclaw/openclaw.with-acp.json << 'OPENCLAW_CONFIG'
${openclawConfigWithAcp}
OPENCLAW_CONFIG

cat > /opt/openclaw/openclaw.no-acp.json << 'OPENCLAW_CONFIG_NO_ACP'
${openclawConfigWithoutAcp}
OPENCLAW_CONFIG_NO_ACP

cp /opt/openclaw/openclaw.with-acp.json /opt/openclaw/openclaw.json

# 4. Write agent persona
cat > /opt/openclaw/workspace-main/SOUL.md << 'SOUL_MD'
${buildSoulTemplate(params)}
SOUL_MD

# 5. Write environment secrets (LiteLLM proxy + AgentMail + PixelPort API)
cat > /opt/openclaw/.env << 'ENV_FILE'
OPENAI_API_KEY=${params.litellmKey}
OPENAI_BASE_URL=${params.litellmUrl}/v1
GEMINI_API_KEY=${params.geminiApiKey}
AGENTMAIL_API_KEY=${params.agentmailApiKey}
PIXELPORT_API_KEY=${params.agentApiKey}
SLACK_APP_TOKEN=${process.env.SLACK_APP_TOKEN || ''}
ENV_FILE

# 6. Set ownership (OpenClaw container runs as node:1000)
chown -R 1000:1000 /opt/openclaw

# 7. Validate OpenClaw config before starting the gateway
validate_openclaw_config() {
  local output_path="$1"

  docker run --rm \\
    --env-file /opt/openclaw/.env \\
    -v /opt/openclaw/openclaw.json:/home/node/.openclaw/openclaw.json \\
    -v /opt/openclaw/workspace-main:/home/node/.openclaw/workspace-main \\
    -v /opt/openclaw/canvas:/home/node/.openclaw/canvas \\
    -v /opt/openclaw/cron:/home/node/.openclaw/cron \\
    -v /opt/openclaw/agents:/home/node/.openclaw/agents \\
    ${params.openclawRuntimeImage} \\
    openclaw.mjs config validate --json 2>&1 | tee "$output_path"
}

if validate_openclaw_config /opt/openclaw/config-validate.with-acp.json; then
  cp /opt/openclaw/config-validate.with-acp.json /opt/openclaw/config-validate.json
else
  if grep -Eiq 'acp([^a-zA-Z0-9_]|$)|acp\\.dispatch|dispatch\\.enabled' /opt/openclaw/config-validate.with-acp.json; then
    echo "ACP dispatch config was rejected by validate; retrying without ACP hardening" >&2
    cp /opt/openclaw/openclaw.no-acp.json /opt/openclaw/openclaw.json

    if validate_openclaw_config /opt/openclaw/config-validate.no-acp.json; then
      cp /opt/openclaw/config-validate.no-acp.json /opt/openclaw/config-validate.json
    else
      cp /opt/openclaw/config-validate.no-acp.json /opt/openclaw/config-validate.json
      echo "OpenClaw config validation failed even after removing ACP dispatch" >&2
      exit 1
    fi
  else
    cp /opt/openclaw/config-validate.with-acp.json /opt/openclaw/config-validate.json
    echo "OpenClaw config validation failed before startup" >&2
    exit 1
  fi
fi

# 8. Run the OpenClaw gateway container
# Use --network host because OpenClaw binds to 127.0.0.1 inside the
# container — host networking makes it accessible on the droplet's public IP.
docker rm -f openclaw-gateway >/dev/null 2>&1 || true
docker run -d \\
  --name openclaw-gateway \\
  --restart unless-stopped \\
  --network host \\
  --env-file /opt/openclaw/.env \\
  -v /opt/openclaw/openclaw.json:/home/node/.openclaw/openclaw.json \\
  -v /opt/openclaw/workspace-main:/home/node/.openclaw/workspace-main \\
  -v /opt/openclaw/canvas:/home/node/.openclaw/canvas \\
  -v /opt/openclaw/cron:/home/node/.openclaw/cron \\
  -v /opt/openclaw/agents:/home/node/.openclaw/agents \\
  ${params.openclawRuntimeImage} \\
  openclaw.mjs gateway --port 18789 --bind lan --allow-unconfigured

echo "PixelPort provisioning complete for ${params.tenantSlug}"
`;
}

function buildOpenClawBrowserDockerfile(baseImage: string): string {
  return `FROM ${baseImage}

USER root

RUN apt-get update \\
  && apt-get install -y --no-install-recommends chromium \\
  && mkdir -p /home/node/.openclaw/browser \\
  && chown -R node:node /home/node/.openclaw \\
  && rm -rf /var/lib/apt/lists/*

USER node
`;
}

function buildOpenClawConfig(params: {
  tenantSlug: string;
  gatewayToken: string;
  litellmUrl: string;
  agentName: string;
  geminiApiKey: string;
  disableAcpDispatch: boolean;
}): Record<string, unknown> {
  const webToolsConfig = params.geminiApiKey
    ? {
        web: {
          search: {
            enabled: true,
            provider: 'gemini',
            gemini: {
              model: 'gemini-2.5-flash',
            },
          },
        },
      }
    : {};

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
    ...(params.disableAcpDispatch
      ? {
          acp: {
            dispatch: {
              enabled: false,
            },
          },
        }
      : {}),
    hooks: buildBootstrapHooksConfig(params.gatewayToken),
    tools: {
      ...webToolsConfig,
      sessions: {
        visibility: 'all',
      },
      agentToAgent: {
        enabled: true,
      },
    },
    agents: {
      defaults: {
        model: {
          primary: 'litellm/gpt-5.4',
          fallbacks: ['litellm/gemini-2.5-flash', 'litellm/gpt-4o-mini'],
        },
        subagents: {
          maxSpawnDepth: 2,
          maxChildrenPerAgent: 5,
        },
      },
      list: [
        {
          id: 'main',
          name: params.agentName,
          workspace: '/home/node/.openclaw/workspace-main',
          model: 'litellm/gpt-5.4',
          subagents: {
            allowAgents: ['*'],
          },
          tools: {
            profile: 'full',
          },
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
              id: 'gpt-5.4',
              name: 'GPT 5.4',
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
              contextWindow: 1048576,
              maxTokens: 8192,
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

  // Vercel deployment URL for API calls
  const apiBaseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://pixelport.ai';

  return `# ${agentName} — AI Chief of Staff for ${params.tenantName}

## Identity
You are ${agentName}, the AI Chief of Staff for ${params.tenantName}. You coordinate marketing operations, manage content production, monitor competitors, and report results. You are the ONLY agent the human interacts with directly.

## Personality & Tone
${personalityDesc}

## Sub-Agent Capabilities
You can dynamically spawn specialist sub-agents to handle specific tasks. Sub-agents run in their own sessions and return results to you.

**When to spawn a sub-agent:**
- Content writing (draft posts, articles, email campaigns)
- Market research (competitor analysis, trend reports)
- Data analysis (performance metrics, audience insights)
- Strategy work (content calendars, campaign planning)

**Sub-agent model selection:**
- Use \`litellm/gpt-5.4\` for complex tasks (strategy, long-form content)
- Use \`litellm/gpt-4o-mini\` for quick tasks (summaries, short drafts, data formatting)
- Use \`litellm/gemini-2.5-flash\` as a cross-provider fallback and for search-grounded synthesis when useful

**Important:** You orchestrate everything. Sub-agents work behind the scenes — the human only talks to you.

## Knowledge Base
${brandContext || 'No website scan results available yet. Ask the human for positioning, audience, and product context before major strategy outputs.'}

## Post-Onboarding Auto-Research
When you first start (or when the vault has sections in "pending" status), automatically run this research sequence:

1. **Company Profile** — Deep-dive into the company. Fill in the vault with positioning, mission, products, and target market.
2. **Brand Voice** — Analyze existing content to define tone, vocabulary, and communication style.
3. **Target Audience & ICP** — Research and document the ideal customer profile.
4. **Competitors** — Identify 3-5 key competitors. Create competitor profiles with analysis.
5. **Products & Services** — Document all products/services with positioning and key benefits.
6. **Content Ideas** — Generate 5-10 initial content ideas based on the research above.

For each research task, spawn a sub-agent, then store results via the API.
The dashboard must reflect that work in real time:
- Create or update task records for major research runs so Recent Activity is backed by real data.
- Set vault sections to \`populating\` while you work and \`ready\` when finished.
- Create a strategy/report task summarizing the initial onboarding findings even if some questions remain open.
- Use only these task_type values when writing tasks: \`draft_content\`, \`research\`, \`competitor_analysis\`, \`strategy\`, \`report\`.
- Use only these task statuses: \`pending\`, \`running\`, \`completed\`, \`failed\`, \`cancelled\`. Never use \`in_progress\`.

## API Integration
You have access to the PixelPort API to read and write data. Use these endpoints to store your work so the dashboard stays up-to-date.

**Authentication:** All API calls use your PIXELPORT_API_KEY from the environment.

\`\`\`bash
# Load environment
. /opt/openclaw/.env

# --- VAULT OPERATIONS ---

# Read all vault sections (check what needs populating)
curl -s -H "X-Agent-Key: $PIXELPORT_API_KEY" ${apiBaseUrl}/api/agent/vault

# Update a vault section (e.g., company_profile)
curl -s -X PUT -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"content": "Your markdown content here", "status": "ready"}' \\
  ${apiBaseUrl}/api/agent/vault/company_profile

# --- TASK OPERATIONS ---

# Research task (use task_type=research for company profile, brand voice, ICP, and product research)
curl -s -X POST -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_role": "Market Research Analyst",
    "task_type": "research",
    "task_description": "Research company profile and positioning",
    "task_output": {"status": "started"},
    "status": "running",
    "requires_approval": false
  }' \\
  ${apiBaseUrl}/api/agent/tasks

# Competitor research task (use task_type=competitor_analysis)
curl -s -X POST -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_role": "Market Research Analyst",
    "task_type": "competitor_analysis",
    "task_description": "Analyze key competitors and create profiles",
    "task_output": {"status": "started"},
    "status": "running",
    "requires_approval": false
  }' \\
  ${apiBaseUrl}/api/agent/tasks

# Create a task (e.g., content draft that needs approval)
curl -s -X POST -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_role": "Content Writer",
    "task_type": "draft_content",
    "task_description": "LinkedIn post about product launch",
    "task_output": {"title": "...", "body": "...", "platform": "linkedin"},
    "status": "completed",
    "requires_approval": true,
    "platform": "linkedin"
  }' \\
  ${apiBaseUrl}/api/agent/tasks

# Update a task (e.g., mark as completed with output)
curl -s -X PATCH -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "completed", "task_output": {"result": "..."}}' \\
  ${apiBaseUrl}/api/agent/tasks/TASK_UUID

# --- COMPETITOR OPERATIONS ---

# Add a competitor profile
curl -s -X POST -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "company_name": "Competitor Inc",
    "website_url": "https://competitor.com",
    "summary": "Direct competitor in the marketing AI space",
    "threat_level": "high",
    "analysis": {"strengths": ["..."], "weaknesses": ["..."]}
  }' \\
  ${apiBaseUrl}/api/agent/competitors

# --- IMAGE GENERATION ---

# Generate a supporting image for content or campaign concepts
curl -s -X POST -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Editorial hero image for a product launch announcement",
    "provider": "openai",
    "model": "gpt-image-1",
    "size": "1024x1024",
    "task_description": "Generate supporting visual for launch campaign"
  }' \\
  ${apiBaseUrl}/api/agent/generate-image
\`\`\`

## Core Responsibilities
1. **Knowledge Management** — Keep the vault populated and up-to-date via auto-research
2. **Content Creation** — Spawn sub-agents for content, store drafts as tasks requiring approval
3. **Competitor Monitoring** — Track competitors, update profiles, alert on significant moves
4. **Visual Support** — Generate supporting images for campaigns and content when useful
5. **Proactive Strategy** — Suggest content ideas, campaigns, and improvements
6. **Reporting** — Respond to human requests promptly with data-backed answers

## Operating Rules
- You are the ONLY interface to the human. Sub-agents work behind the scenes.
- **ALL content requires human approval before publishing.** Create tasks with \`requires_approval: true\`.
- Be proactive — start research immediately, don't wait for instructions.
- Keep the human informed of important developments.
- Store ALL work via the API so the dashboard reflects real progress.
- When a vault section is being populated, set status to "populating". When done, set to "ready".
- Use \`task_type: "research"\` for most onboarding research work, \`task_type: "competitor_analysis"\` for competitor-specific work, \`task_type: "report"\` for the final onboarding summary, and \`task_type: "draft_content"\` for content ideas that need approval.
`;
}
