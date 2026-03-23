import { randomUUID } from 'crypto';
import { isIP } from 'net';
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

type RuntimeIngressSource = 'base_domain' | 'sslip' | 'none';

type RuntimeIngressPlan = {
  hostTemplate: string | null;
  source: RuntimeIngressSource;
};

type ResolvedRuntimeIngress = {
  host: string | null;
  url: string | null;
  source: RuntimeIngressSource;
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
const PAPERCLIP_HANDOFF_SECRET = process.env.PAPERCLIP_HANDOFF_SECRET;

if (!DO_API_TOKEN || !OPENAI_API_KEY || !PAPERCLIP_HANDOFF_SECRET) {
  throw new Error('Missing one or more required env vars: DO_API_TOKEN, OPENAI_API_KEY, PAPERCLIP_HANDOFF_SECRET');
}

const OPENCLAW_BASE_IMAGE = process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:2026.3.13-1';
const OPENCLAW_RUNTIME_IMAGE = resolveOpenClawRuntimeImage(
  OPENCLAW_BASE_IMAGE,
  process.env.OPENCLAW_RUNTIME_IMAGE,
);
const DEFAULT_PAPERCLIP_IMAGE = 'pixelport-paperclip:2026.3.11-handoff-p1';
const PAPERCLIP_IMAGE = firstNonEmpty(process.env.PAPERCLIP_IMAGE) || DEFAULT_PAPERCLIP_IMAGE;
const RECOMMENDED_GOLDEN_IMAGE_SELECTOR = '221189855';
const COMPATIBILITY_DROPLET_IMAGE_SELECTOR = 'ubuntu-24-04-x64';
const DEFAULT_PROVISIONING_DROPLET_SIZE = 's-4vcpu-8gb';
const DEFAULT_PROVISIONING_DROPLET_REGION = 'nyc1';
const RUNTIME_SSLIP_TEMPLATE_TOKEN = '__PUBLIC_IPV4_DASH__';
const DEFAULT_ENABLE_RUNTIME_SSLIP_FALLBACK = true;
const DEFAULT_DISABLE_CONTROL_UI_DEVICE_AUTH = true;
const DO_REGION_FALLBACK_ORDER = ['nyc1', 'nyc3', 'sfo3', 'tor1', 'ams3', 'lon1', 'fra1', 'sgp1'];

type DigitalOceanApiErrorBody = {
  id?: string;
  message?: string;
};

type ExistingTenantDroplet = {
  id: number;
  region: string | null;
};

type CreateTenantDropletParams = {
  tenantSlug: string;
  name: string;
  image: string;
  size: string;
  requestedRegion: string;
  userData: string;
  tags: string[];
  sshKeyIds: number[];
};

type CreateTenantDropletResult = {
  dropletId: string;
  requestedRegion: string;
  reusedExisting: boolean;
};

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

function normalizeRuntimeBaseDomain(rawBaseDomain: string | undefined): string {
  if (typeof rawBaseDomain !== 'string') {
    return '';
  }

  return rawBaseDomain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function isValidDnsLabel(rawLabel: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(rawLabel);
}

function isValidRuntimeHost(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase();
  if (!host || host.length > 253) {
    return false;
  }

  const labels = host.split('.');
  return labels.length >= 2 && labels.every((label) => isValidDnsLabel(label));
}

function isRuntimeSslipFallbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const rawValue = env.PAPERCLIP_RUNTIME_ENABLE_SSLIP_FALLBACK?.trim().toLowerCase();
  if (!rawValue) {
    return DEFAULT_ENABLE_RUNTIME_SSLIP_FALLBACK;
  }

  return rawValue === '1' || rawValue === 'true' || rawValue === 'yes';
}

function isControlUiDeviceAuthBreakglassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const rawValue = env.OPENCLAW_CONTROL_UI_DISABLE_DEVICE_AUTH?.trim().toLowerCase();
  if (!rawValue) {
    return DEFAULT_DISABLE_CONTROL_UI_DEVICE_AUTH;
  }

  return rawValue === '1' || rawValue === 'true' || rawValue === 'yes';
}

export function resolveRuntimeIngressPlan(params: {
  tenantSlug: string;
  env?: NodeJS.ProcessEnv;
}): RuntimeIngressPlan {
  const env = params.env ?? process.env;
  const normalizedSlug = params.tenantSlug.trim().toLowerCase();
  if (!isValidDnsLabel(normalizedSlug)) {
    return {
      hostTemplate: null,
      source: 'none',
    };
  }

  const runtimeBaseDomain = normalizeRuntimeBaseDomain(env.PAPERCLIP_RUNTIME_BASE_DOMAIN);
  if (runtimeBaseDomain) {
    const runtimeHost = `${normalizedSlug}.${runtimeBaseDomain}`;
    if (isValidRuntimeHost(runtimeHost)) {
      return {
        hostTemplate: runtimeHost,
        source: 'base_domain',
      };
    }
  }

  if (isRuntimeSslipFallbackEnabled(env)) {
    return {
      hostTemplate: `${normalizedSlug}.${RUNTIME_SSLIP_TEMPLATE_TOKEN}.sslip.io`,
      source: 'sslip',
    };
  }

  return {
    hostTemplate: null,
    source: 'none',
  };
}

export function resolveRuntimeIngressFromDroplet(params: {
  dropletIp: string;
  runtimeIngressPlan: RuntimeIngressPlan;
}): ResolvedRuntimeIngress {
  if (!params.runtimeIngressPlan.hostTemplate || params.runtimeIngressPlan.source === 'none') {
    return {
      host: null,
      url: null,
      source: 'none',
    };
  }

  const normalizedDropletIp = params.dropletIp.trim();
  const ipVersion = isIP(normalizedDropletIp);
  let host = params.runtimeIngressPlan.hostTemplate;

  if (params.runtimeIngressPlan.source === 'sslip') {
    if (ipVersion !== 4) {
      return {
        host: null,
        url: null,
        source: 'none',
      };
    }

    const ipDash = normalizedDropletIp.split('.').join('-');
    host = host.replace(RUNTIME_SSLIP_TEMPLATE_TOKEN, ipDash);
  }

  if (!isValidRuntimeHost(host)) {
    return {
      host: null,
      url: null,
      source: 'none',
    };
  }

  return {
    host,
    url: `https://${host}`,
    source: params.runtimeIngressPlan.source,
  };
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

function normalizeRegionSlug(region: string): string {
  return region.trim().toLowerCase();
}

export function summarizeDigitalOceanErrorBody(rawBody: string): string {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return 'empty error body';
  }

  try {
    const parsed = JSON.parse(trimmed) as DigitalOceanApiErrorBody;
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';

    if (id && message) {
      return `${id}: ${message}`;
    }

    if (message) {
      return message;
    }

    if (id) {
      return id;
    }
  } catch {
    // Fall back to raw text if the payload is not JSON.
  }

  return trimmed;
}

export function isDropletNameConflictError(rawBody: string): boolean {
  const normalized = summarizeDigitalOceanErrorBody(rawBody).toLowerCase();
  return (
    normalized.includes('name is already in use') ||
    normalized.includes('name already in use') ||
    normalized.includes('name is not unique')
  );
}

export function isDropletRegionOrImageConstraintError(rawBody: string): boolean {
  const normalized = summarizeDigitalOceanErrorBody(rawBody).toLowerCase();

  if (isDropletNameConflictError(rawBody)) {
    return false;
  }

  return (
    normalized.includes('region') ||
    normalized.includes('size') ||
    normalized.includes('slug') ||
    normalized.includes('not available') ||
    normalized.includes('image')
  );
}

export function buildDropletRegionFallbackOrder(
  requestedRegion: string,
  availableImageRegions: string[],
): string[] {
  const preferredOrder = DO_REGION_FALLBACK_ORDER.map((region) => normalizeRegionSlug(region));
  const normalizedRequestedRegion = normalizeRegionSlug(requestedRegion);
  const normalizedAvailableRegions = Array.from(
    new Set(
      availableImageRegions
        .map((region) => normalizeRegionSlug(region))
        .filter((region) => region.length > 0),
    ),
  );
  const availableRegionSet = new Set(normalizedAvailableRegions);
  const result: string[] = [];

  const pushIfAllowed = (region: string): void => {
    if (region.length === 0) {
      return;
    }

    if (availableRegionSet.size > 0 && !availableRegionSet.has(region)) {
      return;
    }

    if (!result.includes(region)) {
      result.push(region);
    }
  };

  pushIfAllowed(normalizedRequestedRegion);

  for (const preferredRegion of preferredOrder) {
    pushIfAllowed(preferredRegion);
  }

  for (const availableRegion of normalizedAvailableRegions) {
    pushIfAllowed(availableRegion);
  }

  if (!result.includes(normalizedRequestedRegion)) {
    result.unshift(normalizedRequestedRegion);
  }

  return result;
}

async function lookupImageRegions(imageSelector: string): Promise<string[]> {
  const normalizedImageSelector = imageSelector.trim();
  if (!normalizedImageSelector || !/^\d+$/.test(normalizedImageSelector)) {
    return [];
  }

  try {
    const response = await fetch(`https://api.digitalocean.com/v2/images/${normalizedImageSelector}`, {
      headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { image?: { regions?: unknown } };
    if (!payload.image || !Array.isArray(payload.image.regions)) {
      return [];
    }

    return payload.image.regions.filter((region): region is string => typeof region === 'string');
  } catch {
    return [];
  }
}

async function findExistingTenantDroplet(params: {
  tenantSlug: string;
  dropletName: string;
}): Promise<ExistingTenantDroplet | null> {
  try {
    const response = await fetch(
      `https://api.digitalocean.com/v2/droplets?tag_name=tenant-${encodeURIComponent(params.tenantSlug)}&per_page=20`,
      {
        headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      droplets?: Array<{ id?: number; name?: string; region?: { slug?: string } }>;
    };
    const droplets = Array.isArray(payload.droplets) ? payload.droplets : [];
    const byExactName = droplets.find(
      (droplet) => typeof droplet.name === 'string' && droplet.name === params.dropletName && typeof droplet.id === 'number',
    );
    const fallback = droplets.find((droplet) => typeof droplet.id === 'number');
    const chosen = byExactName ?? fallback;

    if (!chosen || typeof chosen.id !== 'number') {
      return null;
    }

    return {
      id: chosen.id,
      region: typeof chosen.region?.slug === 'string' ? chosen.region.slug : null,
    };
  } catch {
    return null;
  }
}

async function createTenantDropletWithFallback(
  params: CreateTenantDropletParams,
): Promise<CreateTenantDropletResult> {
  const imageRegions = await lookupImageRegions(params.image);
  const regionQueue = buildDropletRegionFallbackOrder(params.requestedRegion, imageRegions);
  const attemptedRegions: string[] = [];
  const normalizedRegionQueue = regionQueue.map((region) => normalizeRegionSlug(region));
  let lastFailure: { status: number; body: string } | null = null;

  for (const normalizedRegion of normalizedRegionQueue) {
    attemptedRegions.push(normalizedRegion);

    const dropletBody: Record<string, unknown> = {
      name: params.name,
      region: normalizedRegion,
      size: params.size,
      image: params.image,
      user_data: params.userData,
      tags: params.tags,
    };

    if (params.sshKeyIds.length > 0) {
      dropletBody.ssh_keys = params.sshKeyIds;
    }

    const response = await fetch('https://api.digitalocean.com/v2/droplets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DO_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dropletBody),
    });

    if (response.ok) {
      const result = (await response.json()) as { droplet: { id: number } };

      return {
        dropletId: String(result.droplet.id),
        requestedRegion: normalizedRegion,
        reusedExisting: false,
      };
    }

    const errorBody = await response.text();
    lastFailure = { status: response.status, body: errorBody };

    if (response.status === 422 && isDropletNameConflictError(errorBody)) {
      const existingDroplet = await findExistingTenantDroplet({
        tenantSlug: params.tenantSlug,
        dropletName: params.name,
      });

      if (existingDroplet) {
        return {
          dropletId: String(existingDroplet.id),
          requestedRegion: existingDroplet.region
            ? normalizeRegionSlug(existingDroplet.region)
            : normalizedRegion,
          reusedExisting: true,
        };
      }
    }

    const retriableRegionMismatch =
      response.status === 422 &&
      isDropletRegionOrImageConstraintError(errorBody) &&
      attemptedRegions.length < normalizedRegionQueue.length;

    if (retriableRegionMismatch) {
      console.warn(
        `[provision-tenant] Droplet create rejected in region ${normalizedRegion}; ` +
          `trying fallback region. DO response: ${summarizeDigitalOceanErrorBody(errorBody)}`,
      );
      continue;
    }

    break;
  }

  const attemptedRegionSummary = attemptedRegions.join(',');
  const failureStatus = lastFailure?.status ?? 500;
  const failureBody = summarizeDigitalOceanErrorBody(lastFailure?.body ?? 'unknown droplet error');

  throw new Error(
    `Droplet creation failed (HTTP ${failureStatus}): ${failureBody} ` +
      `[size=${params.size}, region=${params.requestedRegion}, image=${params.image}, attempted_regions=${attemptedRegionSummary}]`,
  );
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

    const runtimeIngressPlan = await step.run('resolve-runtime-ingress-plan', async () => {
      return resolveRuntimeIngressPlan({
        tenantSlug: tenant.slug,
      });
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

      // Generate Paperclip API key for dashboard proxy → Paperclip auth
      const paperclipApiKey = `pak-${randomUUID()}`;

      const cloudInit = buildCloudInit({
        tenantId,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        gatewayToken,
        runtimeHostTemplate: runtimeIngressPlan.hostTemplate,
        disableControlUiDeviceAuth: isControlUiDeviceAuthBreakglassEnabled(),
        openclawBaseImage: OPENCLAW_BASE_IMAGE,
        openclawRuntimeImage: OPENCLAW_RUNTIME_IMAGE,
        paperclipImage: PAPERCLIP_IMAGE,
        openaiApiKey: OPENAI_API_KEY,
        paperclipHandoffSecret: PAPERCLIP_HANDOFF_SECRET,
        supabaseUrl,
        supabaseServiceRoleKey,
        memoryOpenAiApiKey: memoryProvisioningPlan.memoryOpenAiApiKey,
        memoryNativeEnabled: memoryProvisioningPlan.effectiveNativeEnabled,
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        agentmailApiKey: AGENTMAIL_API_KEY || '',
        agentApiKey,
        paperclipApiKey,
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

      const createResult = await createTenantDropletWithFallback({
        tenantSlug: tenant.slug,
        name: `pixelport-${tenant.slug}`,
        image: requestedImage,
        size: requestedSize,
        requestedRegion,
        userData: cloudInit,
        tags: ['pixelport', `tenant-${tenant.slug}`, 'pixelport-trial'],
        sshKeyIds,
      });

      if (createResult.reusedExisting) {
        console.warn(
          `[provision-tenant] Reusing existing tenant droplet ${createResult.dropletId} ` +
            `for slug ${tenant.slug} after duplicate-name create rejection.`,
        );
      }

      return {
        dropletId: createResult.dropletId,
        gatewayToken,
        agentApiKey,
        paperclipApiKey,
        requestedSize,
        requestedRegion: createResult.requestedRegion,
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

    const runtimeIngress = await step.run('resolve-runtime-ingress', async () => {
      return resolveRuntimeIngressFromDroplet({
        dropletIp,
        runtimeIngressPlan,
      });
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
      const nextOnboardingData: Json = {
        ...onboardingData,
        runtime_url: runtimeIngress.url,
        runtime_https_url: runtimeIngress.url,
        runtime_host: runtimeIngress.host,
        runtime_url_source: runtimeIngress.source,
        runtime_url_updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tenants')
        .update({
          droplet_id: droplet.dropletId,
          droplet_ip: dropletIp,
          gateway_token: droplet.gatewayToken,
          agentmail_inbox: agentmailInbox,
          agent_api_key: droplet.agentApiKey,
          paperclip_api_key: droplet.paperclipApiKey,
          onboarding_data: nextOnboardingData,
        })
        .eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to update tenant infra refs: ${error.message}`);
      }

      onboardingData = nextOnboardingData;
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

    // Poll for Paperclip readiness on port 3100
    const paperclipUrl = `http://${dropletIp}:3100`;
    const paperclipMaxAttempts = 20;
    let paperclipReady = false;
    for (let i = 0; i < paperclipMaxAttempts; i += 1) {
      const isReady = await step.run(`check-paperclip-${i}`, async () => {
        try {
          const response = await fetch(`${paperclipUrl}/api/health`, {
            signal: AbortSignal.timeout(5_000),
          });

          return response.ok;
        } catch {
          return false;
        }
      });

      if (isReady) {
        paperclipReady = true;
        break;
      }

      if (i < paperclipMaxAttempts - 1) {
        await step.sleep(`wait-paperclip-${i}`, '10s');
      }
    }

    if (!paperclipReady) {
      throw new Error('Paperclip server did not become healthy within 3 minutes');
    }

    const paperclipRefsMaxAttempts = 20;
    let paperclipCompanyId = '';
    let resolvedPaperclipApiKey = '';
    for (let i = 0; i < paperclipRefsMaxAttempts; i += 1) {
      const refs = await step.run(`read-paperclip-refs-${i}`, async () => {
        const { data, error } = await supabase
          .from('tenants')
          .select('paperclip_company_id, paperclip_api_key')
          .eq('id', tenantId)
          .single();

        if (error) {
          throw new Error(`Failed to read Paperclip refs from Supabase: ${error.message}`);
        }

        return {
          companyId: typeof data?.paperclip_company_id === 'string' ? data.paperclip_company_id.trim() : '',
          apiKey: typeof data?.paperclip_api_key === 'string' ? data.paperclip_api_key.trim() : '',
        };
      });

      if (refs.companyId && refs.apiKey) {
        paperclipCompanyId = refs.companyId;
        resolvedPaperclipApiKey = refs.apiKey;
        break;
      }

      if (i < paperclipRefsMaxAttempts - 1) {
        await step.sleep(`wait-paperclip-refs-${i}`, '5s');
      }
    }

    if (!paperclipCompanyId || !resolvedPaperclipApiKey) {
      throw new Error(
        'Paperclip bootstrap did not persist company/key in time. ' +
        'Check cloud-init logs on the droplet (/var/log/cloud-init-output.log).',
      );
    }

    await step.run('store-paperclip-refs', async () => {
      const { error } = await supabase
        .from('tenants')
        .update({
          paperclip_company_id: paperclipCompanyId,
          paperclip_api_key: resolvedPaperclipApiKey,
        })
        .eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to store Paperclip refs: ${error.message}`);
      }
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
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  gatewayToken: string;
  runtimeHostTemplate?: string | null;
  disableControlUiDeviceAuth?: boolean;
  openclawBaseImage: string;
  openclawRuntimeImage: string;
  paperclipImage: string;
  openaiApiKey: string;
  paperclipHandoffSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  memoryOpenAiApiKey: string;
  memoryNativeEnabled: boolean;
  geminiApiKey: string;
  agentmailApiKey: string;
  agentApiKey: string;
  paperclipApiKey: string;
  onboardingData: Json;
}): string {
  const agentName = (params.onboardingData.agent_name as string) || 'Luna';
  const workspaceWriteCommands = buildWorkspaceWriteCommands({
    tenantName: params.tenantName,
    tenantSlug: params.tenantSlug,
    onboardingData: params.onboardingData,
  });
  const openclawConfigWithAcp = JSON.stringify(
    buildOpenClawConfig({
      ...params,
      agentName,
      disableAcpDispatch: true,
      disableControlUiDeviceAuth:
        params.disableControlUiDeviceAuth ?? DEFAULT_DISABLE_CONTROL_UI_DEVICE_AUTH,
    }),
    null,
    2
  );
  const openclawConfigWithoutAcp = JSON.stringify(
    buildOpenClawConfig({
      ...params,
      agentName,
      disableAcpDispatch: false,
      disableControlUiDeviceAuth:
        params.disableControlUiDeviceAuth ?? DEFAULT_DISABLE_CONTROL_UI_DEVICE_AUTH,
    }),
    null,
    2
  );
  const paperclipCompanyPayloadBase64 = Buffer.from(
    JSON.stringify({ name: params.tenantName }),
    'utf8',
  ).toString('base64');

  return `#!/bin/bash
set -euo pipefail

# PixelPort Tenant Provisioning — Docker-based OpenClaw
# Tenant: ${params.tenantSlug}
# Base image: ${params.openclawBaseImage}
# Runtime image: ${params.openclawRuntimeImage}

export DEBIAN_FRONTEND=noninteractive
RUNTIME_HOST_TEMPLATE='${params.runtimeHostTemplate ?? ''}'
RUNTIME_HOST=''

if [ -n "$RUNTIME_HOST_TEMPLATE" ]; then
  RUNTIME_HOST="$RUNTIME_HOST_TEMPLATE"
  if [[ "$RUNTIME_HOST" == *'${RUNTIME_SSLIP_TEMPLATE_TOKEN}'* ]]; then
    PUBLIC_IPV4="$(curl -fsS http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)"
    if [ -n "$PUBLIC_IPV4" ]; then
      PUBLIC_IPV4_DASH="$(printf '%s' "$PUBLIC_IPV4" | tr '.' '-')"
      RUNTIME_HOST="$(printf '%s' "$RUNTIME_HOST" | sed "s/${RUNTIME_SSLIP_TEMPLATE_TOKEN}/$PUBLIC_IPV4_DASH/g")"
    else
      echo "Unable to resolve public IPv4 for SSLIP runtime host template; HTTPS ingress will remain disabled." >&2
      RUNTIME_HOST=''
    fi
  fi
fi

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
if docker image inspect ${params.openclawRuntimeImage} >/dev/null 2>&1; then
  echo "Using preloaded runtime image ${params.openclawRuntimeImage}"
else
  docker pull ${params.openclawRuntimeImage}
fi

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
PAPERCLIP_HANDOFF_SECRET=${params.paperclipHandoffSecret}
MEMORY_OPENAI_API_KEY=${params.memoryOpenAiApiKey}
GEMINI_API_KEY=${params.geminiApiKey}
AGENTMAIL_API_KEY=${params.agentmailApiKey}
PIXELPORT_API_KEY=${params.agentApiKey}
PAPERCLIP_API_KEY=${params.paperclipApiKey}
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

# 9. Configure HTTPS runtime ingress via Caddy when a runtime host is available.
if [ -n "$RUNTIME_HOST" ]; then
  if ! command -v caddy >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y caddy
  fi

  cat > /etc/caddy/Caddyfile <<CADDYFILE
$RUNTIME_HOST {
  reverse_proxy 127.0.0.1:18789
}
CADDYFILE

  systemctl enable caddy
  systemctl restart caddy
fi

# 10. Normalize runtime state permissions required by memory/device features
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

# 11. Start a fresh Paperclip + Postgres runtime for this tenant.
PAPERCLIP_DB_PASS="$(openssl rand -hex 24)"
PAPERCLIP_BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
PAPERCLIP_PUBLIC_IP="$(curl -fsS http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)"

docker network create paperclip-net >/dev/null 2>&1 || true
mkdir -p /opt/paperclip-db /opt/paperclip
chown -R 1000:1000 /opt/paperclip

docker rm -f paperclip paperclip-bootstrap paperclip-db >/dev/null 2>&1 || true
rm -rf /opt/paperclip-db

if docker image inspect postgres:17-alpine >/dev/null 2>&1; then
  echo "Using preloaded postgres:17-alpine"
else
  docker pull postgres:17-alpine
fi

docker run -d --name paperclip-db \\
  --network paperclip-net \\
  --restart unless-stopped \\
  -p 127.0.0.1:5433:5432 \\
  -e POSTGRES_USER=paperclip \\
  -e "POSTGRES_PASSWORD=$PAPERCLIP_DB_PASS" \\
  -e POSTGRES_DB=paperclip \\
  -v /opt/paperclip-db:/var/lib/postgresql/data \\
  postgres:17-alpine

# Wait for Postgres readiness.
for i in $(seq 1 30); do
  if docker exec paperclip-db pg_isready -U paperclip -d paperclip >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if docker image inspect ${params.paperclipImage} >/dev/null 2>&1; then
  echo "Using preloaded Paperclip image ${params.paperclipImage}"
else
  docker pull ${params.paperclipImage}
fi

# Bootstrap in local_trusted mode to create tenant company + API key.
docker run -d --name paperclip-bootstrap \\
  --network host \\
  --restart unless-stopped \\
  -e NODE_ENV=production \\
  -e HOST=127.0.0.1 \\
  -e PORT=3100 \\
  -e PAPERCLIP_DEPLOYMENT_MODE=local_trusted \\
  -e "DATABASE_URL=postgresql://paperclip:$PAPERCLIP_DB_PASS@127.0.0.1:5433/paperclip" \\
  -e "BETTER_AUTH_SECRET=$PAPERCLIP_BETTER_AUTH_SECRET" \\
  -e "PAPERCLIP_HANDOFF_SECRET=${params.paperclipHandoffSecret}" \\
  -v /opt/paperclip:/opt/paperclip \\
  ${params.paperclipImage}

BOOTSTRAP_READY=0
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3100/api/health >/dev/null 2>&1; then
    BOOTSTRAP_READY=1
    break
  fi
  sleep 3
done

if [ "$BOOTSTRAP_READY" -ne 1 ]; then
  echo "Paperclip bootstrap did not become ready within 90s" >&2
  docker logs paperclip-bootstrap >&2 || true
  exit 1
fi

COMPANY_ID=''
COMPANY_PAYLOAD="$(printf '%s' '${paperclipCompanyPayloadBase64}' | base64 -d)"
for attempt in $(seq 1 5); do
  COMPANY_RESP=$(curl -sf -X POST http://127.0.0.1:3100/api/companies \\
    -H 'Content-Type: application/json' \\
    -d "$COMPANY_PAYLOAD" || echo '{}')
  COMPANY_ID=$(echo "$COMPANY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('company',{}).get('id',''))" 2>/dev/null || echo '')
  if [ -n "$COMPANY_ID" ]; then
    break
  fi
  sleep 3
done

if [ -z "$COMPANY_ID" ]; then
  echo "Failed to create Paperclip company. Response: $COMPANY_RESP" >&2
  exit 1
fi

AGENT_RESP=$(curl -sf -X POST "http://127.0.0.1:3100/api/companies/$COMPANY_ID/agents" \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Chief"}' || echo '{}')
AGENT_ID=$(echo "$AGENT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('agent',{}).get('id',''))" 2>/dev/null || echo '')

if [ -z "$AGENT_ID" ]; then
  echo "Failed to create Paperclip agent. Response: $AGENT_RESP" >&2
  exit 1
fi

KEY_RESP=$(curl -sf -X POST "http://127.0.0.1:3100/api/agents/$AGENT_ID/keys" \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"tenant-api-key"}' || echo '{}')
API_TOKEN=$(echo "$KEY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null || echo '')

if [ -z "$API_TOKEN" ]; then
  echo "Failed to create Paperclip API key. Response: $KEY_RESP" >&2
  exit 1
fi

# Persist the generated Paperclip refs before switching to authenticated mode.
SUPABASE_PAYLOAD="$(printf '{"paperclip_company_id":"%s","paperclip_api_key":"%s"}' "$COMPANY_ID" "$API_TOKEN")"
curl -sf -X PATCH "${params.supabaseUrl}/rest/v1/tenants?id=eq.${params.tenantId}" \\
  -H "apikey: ${params.supabaseServiceRoleKey}" \\
  -H "Authorization: Bearer ${params.supabaseServiceRoleKey}" \\
  -H 'Content-Type: application/json' \\
  -H 'Prefer: return=minimal' \\
  -d "$SUPABASE_PAYLOAD" >/dev/null || {
  echo "Failed to persist Paperclip refs in Supabase" >&2
  exit 1
}

if [ -n "$PAPERCLIP_PUBLIC_IP" ]; then
  BETTER_AUTH_URL="http://$PAPERCLIP_PUBLIC_IP:3100"
else
  BETTER_AUTH_URL="http://127.0.0.1:3100"
fi

docker stop paperclip-bootstrap >/dev/null 2>&1 || true
docker rm -f paperclip-bootstrap >/dev/null 2>&1 || true

docker run -d --name paperclip \\
  --network paperclip-net \\
  --restart unless-stopped \\
  -p 3100:3100 \\
  -e NODE_ENV=production \\
  -e HOST=0.0.0.0 \\
  -e PORT=3100 \\
  -e PAPERCLIP_DEPLOYMENT_MODE=authenticated \\
  -e "BETTER_AUTH_URL=$BETTER_AUTH_URL" \\
  -e "DATABASE_URL=postgresql://paperclip:$PAPERCLIP_DB_PASS@paperclip-db:5432/paperclip" \\
  -e "BETTER_AUTH_SECRET=$PAPERCLIP_BETTER_AUTH_SECRET" \\
  -e "PAPERCLIP_HANDOFF_SECRET=${params.paperclipHandoffSecret}" \\
  -v /opt/paperclip:/opt/paperclip \\
  ${params.paperclipImage}

# Keep OpenClaw env aligned with the generated Paperclip API key.
if [ -f /opt/openclaw/.env ]; then
  sed -i.bak "s/^PAPERCLIP_API_KEY=.*/PAPERCLIP_API_KEY=$API_TOKEN/" /opt/openclaw/.env || true
  docker restart openclaw-gateway >/dev/null 2>&1 || true
fi

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
  disableControlUiDeviceAuth?: boolean;
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
        // Temporary D4 break-glass to unblock Launch->workspace over public HTTPS hosts.
        dangerouslyDisableDeviceAuth:
          params.disableControlUiDeviceAuth ?? DEFAULT_DISABLE_CONTROL_UI_DEVICE_AUTH,
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
