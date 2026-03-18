import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { persistBootstrapState } from '../../lib/bootstrap-state';
import {
  MEMORY_OPENAI_API_KEY_ENV,
  buildOpenClawMemorySearchConfig,
  resolveTenantMemoryProvisioningPlan,
} from '../../lib/tenant-memory-settings';
import { buildWorkspaceScaffold } from '../../lib/workspace-contract';
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

type DropletBaseline = {
  image: string;
  size: string;
  region: string;
  imageSource: 'managed' | 'compatibility' | 'missing';
};

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const DO_API_TOKEN = process.env.DO_API_TOKEN;
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!DO_API_TOKEN || !OPENAI_API_KEY) {
  throw new Error('Missing one or more required env vars: DO_API_TOKEN, OPENAI_API_KEY');
}

const OPENCLAW_BASE_IMAGE = process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:2026.3.11';
const OPENCLAW_RUNTIME_IMAGE = resolveOpenClawRuntimeImage(
  OPENCLAW_BASE_IMAGE,
  process.env.OPENCLAW_RUNTIME_IMAGE,
);
const RECOMMENDED_GOLDEN_IMAGE_SELECTOR = 'pixelport-paperclip-golden-2026-03-16';
const COMPATIBILITY_DROPLET_IMAGE_SELECTOR = 'ubuntu-24-04-x64';
const DEFAULT_PROVISIONING_DROPLET_SIZE = 's-4vcpu-8gb';
const DEFAULT_PROVISIONING_DROPLET_REGION = 'nyc1';

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function isCompatibilityDropletImageSelector(imageSelector: string): boolean {
  return imageSelector.trim().toLowerCase() === COMPATIBILITY_DROPLET_IMAGE_SELECTOR;
}

function isManagedGoldenImageRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function resolveDropletBaseline(env: NodeJS.ProcessEnv = process.env): DropletBaseline {
  const configuredImage = firstNonEmpty(
    env.PROVISIONING_DROPLET_IMAGE,
    env.PIXELPORT_DROPLET_IMAGE,
    env.DO_GOLDEN_IMAGE_ID,
  );
  const configuredSize = firstNonEmpty(
    env.PROVISIONING_DROPLET_SIZE,
    env.PIXELPORT_DROPLET_SIZE,
  );
  const configuredRegion = firstNonEmpty(
    env.PROVISIONING_DROPLET_REGION,
    env.PIXELPORT_DROPLET_REGION,
  );

  const imageSource = !configuredImage
    ? 'missing'
    : isCompatibilityDropletImageSelector(configuredImage)
      ? 'compatibility'
      : 'managed';

  return {
    image: configuredImage || '',
    size: configuredSize || DEFAULT_PROVISIONING_DROPLET_SIZE,
    region: configuredRegion || DEFAULT_PROVISIONING_DROPLET_REGION,
    imageSource,
  };
}

const DROPLET_BASELINE = resolveDropletBaseline();

export function assertGoldenImageConfigured(
  baseline: DropletBaseline,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (baseline.imageSource === 'missing' || !baseline.image) {
    throw new Error(
      `Missing provisioning golden image selector. Set PROVISIONING_DROPLET_IMAGE ` +
      `(recommended baseline: ${RECOMMENDED_GOLDEN_IMAGE_SELECTOR}). ` +
      `Accepted inputs: PROVISIONING_DROPLET_IMAGE, PIXELPORT_DROPLET_IMAGE, DO_GOLDEN_IMAGE_ID.`
    );
  }

  if (baseline.imageSource === 'compatibility' && isManagedGoldenImageRequired(env)) {
    throw new Error(
      `Managed golden image selector required. Current value "${baseline.image}" is a compatibility selector. ` +
      `Set PROVISIONING_DROPLET_IMAGE to a maintained golden image artifact and retry.`
    );
  }
}

export function resolveOpenClawRuntimeImage(
  baseImage: string,
  runtimeImageOverride?: string,
): string {
  const override = runtimeImageOverride?.trim();
  return override && override.length > 0 ? override : baseImage;
}

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
    const memoryProvisioningPlan = await step.run('resolve-memory-settings', async () => {
      const plan = resolveTenantMemoryProvisioningPlan({
        settings: tenant.settings,
        memoryOpenAiApiKey: process.env.MEMORY_OPENAI_API_KEY,
      });

      if (plan.nativeDowngradedMissingApiKey) {
        console.warn(
          `[provision-tenant] ${MEMORY_OPENAI_API_KEY_ENV} is missing; ` +
          `continuing with native memory disabled for tenant ${tenantId}.`
        );
      }

      return plan;
    });

    if (memoryProvisioningPlan.nativeDowngradedMissingApiKey) {
      onboardingData = await step.run('record-memory-downgrade', async (): Promise<Json> => {
        const memoryRuntimeWarning = {
          code: 'native_memory_disabled_missing_key',
          reason: `${MEMORY_OPENAI_API_KEY_ENV} was missing during provisioning`,
          checked_at: new Date().toISOString(),
          requested_native_enabled: memoryProvisioningPlan.requestedNativeEnabled,
          effective_native_enabled: memoryProvisioningPlan.effectiveNativeEnabled,
          mem0_enabled: memoryProvisioningPlan.mem0Enabled,
        };

        const nextOnboardingData = {
          ...onboardingData,
          provisioning_memory: memoryRuntimeWarning,
        };

        const { data, error } = await supabase
          .from('tenants')
          .update({ onboarding_data: nextOnboardingData })
          .eq('id', tenantId)
          .select('onboarding_data')
          .single();

        if (error) {
          throw new Error(`Failed to persist memory downgrade warning: ${error.message}`);
        }

        return (data?.onboarding_data as Json | null) ?? nextOnboardingData;
      });
    }

    const droplet = await step.run('create-droplet', async () => {
      const gatewayToken = `gw-${randomUUID()}`;
      const requestedSize = trialMode
        ? firstNonEmpty(testDropletSize, DROPLET_BASELINE.size) || DROPLET_BASELINE.size
        : DROPLET_BASELINE.size;
      const requestedRegion = firstNonEmpty(regionOverride, DROPLET_BASELINE.region) || DROPLET_BASELINE.region;
      assertGoldenImageConfigured(DROPLET_BASELINE);
      const requestedImage = DROPLET_BASELINE.image;
      if (DROPLET_BASELINE.imageSource === 'compatibility') {
        console.warn(
          `[provision-tenant] Using compatibility image selector "${requestedImage}". ` +
          'Promote PROVISIONING_DROPLET_IMAGE to a managed golden image artifact when ready.',
        );
      }

      // Generate agent API key for Chief → Vercel API auth
      const agentApiKey = `ppk-${randomUUID()}`;

      const cloudInit = buildCloudInit({
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        gatewayToken,
        openclawBaseImage: OPENCLAW_BASE_IMAGE,
        openclawRuntimeImage: OPENCLAW_RUNTIME_IMAGE,
        openaiApiKey: OPENAI_API_KEY,
        memoryOpenAiApiKey: memoryProvisioningPlan.memoryOpenAiApiKey,
        memoryNativeEnabled: memoryProvisioningPlan.effectiveNativeEnabled,
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
        image: requestedImage,
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
          `[size=${requestedSize}, region=${requestedRegion}, image=${requestedImage}]`
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
      agentmailInbox,
      bootstrapAccepted: bootstrapResult.ok,
      bootstrapStatus: bootstrapResult.status,
      memoryNativeEnabled: memoryProvisioningPlan.effectiveNativeEnabled,
      memoryNativeDowngraded: memoryProvisioningPlan.nativeDowngradedMissingApiKey,
      trialMode: !!trialMode,
      requestedSize: droplet.requestedSize,
      requestedRegion: droplet.requestedRegion,
    };
  }
);

function getApiBaseUrl(): string {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://pixelport.ai';
}

function buildWorkspaceWriteCommands(params: {
  tenantName: string;
  tenantSlug: string;
  onboardingData: Json;
}): string {
  const scaffold = buildWorkspaceScaffold({
    tenantName: params.tenantName,
    tenantSlug: params.tenantSlug,
    onboardingData: params.onboardingData,
    apiBaseUrl: getApiBaseUrl(),
  });

  const directoryCommands = scaffold.directories.map(
    (directory) => `mkdir -p /opt/openclaw/workspace-main/${directory}`
  );

  const fileCommands = Object.entries(scaffold.files).map(([relativePath, content], index) => {
    const heredocTag = `WORKSPACE_FILE_${index}`;
    return `cat > /opt/openclaw/workspace-main/${relativePath} << '${heredocTag}'
${content}
${heredocTag}`;
  });

  return [...directoryCommands, ...fileCommands].join('\n\n');
}

export function buildCloudInit(params: {
  tenantSlug: string;
  tenantName: string;
  gatewayToken: string;
  openclawBaseImage: string;
  openclawRuntimeImage: string;
  openaiApiKey: string;
  memoryOpenAiApiKey: string;
  memoryNativeEnabled: boolean;
  geminiApiKey: string;
  agentmailApiKey: string;
  agentApiKey: string;
  onboardingData: Json;
}): string {
  const agentName = (params.onboardingData.agent_name as string) || 'Luna';
  const workspaceWriteCommands = buildWorkspaceWriteCommands({
    tenantName: params.tenantName,
    tenantSlug: params.tenantSlug,
    onboardingData: params.onboardingData,
  });
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

# 2. Pull the OpenClaw runtime image
mkdir -p /opt/openclaw
mkdir -p /opt/openclaw/workspace-main
mkdir -p /opt/openclaw/canvas
mkdir -p /opt/openclaw/cron
mkdir -p /opt/openclaw/agents
docker pull ${params.openclawRuntimeImage}

# 3. Write agent configuration candidates
cat > /opt/openclaw/openclaw.with-acp.json << 'OPENCLAW_CONFIG'
${openclawConfigWithAcp}
OPENCLAW_CONFIG

cat > /opt/openclaw/openclaw.no-acp.json << 'OPENCLAW_CONFIG_NO_ACP'
${openclawConfigWithoutAcp}
OPENCLAW_CONFIG_NO_ACP

cp /opt/openclaw/openclaw.with-acp.json /opt/openclaw/openclaw.json

# 4. Write workspace contract
${workspaceWriteCommands}

# 5. Write environment secrets (OpenAI + AgentMail + PixelPort API)
cat > /opt/openclaw/.env << 'ENV_FILE'
OPENAI_API_KEY=${params.openaiApiKey}
MEMORY_OPENAI_API_KEY=${params.memoryOpenAiApiKey}
GEMINI_API_KEY=${params.geminiApiKey}
AGENTMAIL_API_KEY=${params.agentmailApiKey}
PIXELPORT_API_KEY=${params.agentApiKey}
SLACK_APP_TOKEN=${process.env.SLACK_APP_TOKEN || ''}
ENV_FILE

# 6. Set ownership (OpenClaw container runs as node:1000)
chown -R 1000:1000 /opt/openclaw
chmod 600 /opt/openclaw/openclaw.json /opt/openclaw/.env

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

# 9. Normalize runtime state permissions required by memory/device features
normalize_runtime_state_perms() {
  local attempts=0
  until docker exec -u 0 openclaw-gateway sh -lc '
    set -e
    mkdir -p /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices
    chown 1000:1000 /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices
    chmod 700 /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices
  '; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 5 ]; then
      echo "Failed to normalize OpenClaw runtime state permissions" >&2
      exit 1
    fi
    sleep 2
  done
}

normalize_runtime_state_perms

echo "PixelPort provisioning complete for ${params.tenantSlug}"
`;
}

export function buildOpenClawConfig(params: {
  tenantSlug: string;
  gatewayToken: string;
  agentName: string;
  memoryNativeEnabled: boolean;
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
          primary: 'openai/gpt-5.4',
          fallbacks: ['google/gemini-2.5-flash', 'openai/gpt-4o-mini'],
        },
        memorySearch: buildOpenClawMemorySearchConfig(params.memoryNativeEnabled),
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
          model: 'openai/gpt-5.4',
          subagents: {
            allowAgents: ['*'],
          },
          tools: {
            profile: 'full',
            deny: ['browser'],
          },
        },
      ],
    },
  };
}
