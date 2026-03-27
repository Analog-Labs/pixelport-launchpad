import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID } from 'crypto';
import { isIP } from 'net';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { persistBootstrapState } from '../../lib/bootstrap-state';
import {
  MEMORY_OPENAI_API_KEY_ENV,
  buildOpenClawMemorySearchConfig,
  resolveTenantMemoryProvisioningPlan,
} from '../../lib/tenant-memory-settings';
import {
  WORKSPACE_CONTRACT_VERSION,
  WORKSPACE_MEMORY_CONTRACT_VERSION,
  WORKSPACE_ROOT_PROMPT_FILES,
  buildWorkspaceScaffold,
} from '../../lib/workspace-contract';
import {
  KNOWLEDGE_SYNC_REQUESTED_EVENT,
  markKnowledgeMirrorPending,
  markKnowledgeMirrorSeededRevision,
  markKnowledgeMirrorSyncFailed,
  markKnowledgeMirrorSynced,
  normalizeKnowledgeMirror,
  withKnowledgeMirror,
} from '../../lib/knowledge-mirror';
import {
  buildBootstrapHooksConfig,
} from '../../lib/onboarding-bootstrap';
import {
  autoApproveGatewayPairing,
  classifyGatewayFailure,
  formatGatewayDiagnostic,
  isPairingRecoveryEligible,
} from '../../lib/openclaw-bootstrap-guard';
import { approveGatewayPairingViaSsh } from '../../lib/openclaw-pairing-ssh';

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
const DEFAULT_DISABLE_OPENCLAW_GATEWAY_DEVICE_AUTH = false;
const DO_REGION_FALLBACK_ORDER = ['nyc1', 'nyc3', 'sfo3', 'tor1', 'ams3', 'lon1', 'fra1', 'sgp1'];

type DigitalOceanApiErrorBody = {
  id?: string;
  message?: string;
  error?: string;
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

type PaperclipAgentRecord = {
  id: string;
  name?: string | null;
  urlKey?: string | null;
  adapterType?: string | null;
  adapterConfig?: Record<string, unknown> | null;
};

type PaperclipIssueRecord = {
  id: string;
  title?: string | null;
};

type PaperclipApprovalRecord = {
  id: string;
  payload?: Record<string, unknown> | null;
};

type PaperclipWakeResponse = {
  id?: string;
  run?: {
    id?: string;
  };
};

type PaperclipHeartbeatRunRecord = {
  id?: string;
  status?: string | null;
  error?: string | null;
  errorCode?: string | null;
  stdoutExcerpt?: string | null;
  stderrExcerpt?: string | null;
};

type StartupResourceSnapshot = {
  tenantId: string;
  tenantSlug: string;
  dropletId: string | null;
  dropletIp: string | null;
  workspaceSeeded: boolean;
  paperclipCompanyId: string | null;
  kickoffIssueId: string | null;
  kickoffApprovalId: string | null;
  readinessRunId: string | null;
};

const ONBOARDING_KICKOFF_SEED_TAG = 'pixelport_onboarding_kickoff_v1';
const OPENCLAW_GATEWAY_ADAPTER_TYPE = 'openclaw_gateway';
const OPENCLAW_GATEWAY_DOCKER_HOST_ALIAS = 'host.docker.internal';
const OPENCLAW_GATEWAY_DEFAULT_WS_PORT = 18789;
const OPENCLAW_GATEWAY_SESSION_KEY_STRATEGY = 'issue';
const OPENCLAW_GATEWAY_WAIT_TIMEOUT_MS = 120_000;
const OPENCLAW_GATEWAY_ROLE = 'operator';
const OPENCLAW_GATEWAY_SCOPES = [
  'operator.read',
  'operator.write',
  'operator.admin',
  'operator.approvals',
  'operator.pairing',
] as const;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveDeviceIdFromPrivateKeyPem(privateKeyPem: string): string | null {
  try {
    const privateKey = createPrivateKey(privateKeyPem);
    const publicKey = createPublicKey(privateKey);
    const exported = publicKey.export({ type: 'spki', format: 'der' });
    const der = Buffer.isBuffer(exported) ? exported : Buffer.from(exported);

    if (
      der.length <= ED25519_SPKI_PREFIX.length ||
      !der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
    ) {
      return null;
    }

    const rawPublicKey = der.subarray(ED25519_SPKI_PREFIX.length);
    return createHash('sha256').update(rawPublicKey).digest('hex');
  } catch {
    return null;
  }
}

function resolveGatewayDeviceIdentity(
  adapterConfig: Record<string, unknown> | null | undefined,
): { deviceId: string; devicePrivateKeyPem: string } {
  const existingPrivateKey = readTrimmedString(adapterConfig?.devicePrivateKeyPem);
  if (existingPrivateKey) {
    const derivedDeviceId = deriveDeviceIdFromPrivateKeyPem(existingPrivateKey);
    if (derivedDeviceId) {
      return {
        deviceId: derivedDeviceId,
        devicePrivateKeyPem: existingPrivateKey,
      };
    }
  }

  const generated = generateKeyPairSync('ed25519');
  const devicePrivateKeyPem = generated.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const deviceId = deriveDeviceIdFromPrivateKeyPem(devicePrivateKeyPem);
  if (!deviceId) {
    throw new Error('Failed to derive OpenClaw device identity for gateway adapter');
  }

  return {
    deviceId,
    devicePrivateKeyPem,
  };
}

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

function isOpenClawGatewayDeviceAuthDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const rawValue = env.OPENCLAW_GATEWAY_DISABLE_DEVICE_AUTH?.trim().toLowerCase();
  if (!rawValue) {
    return DEFAULT_DISABLE_OPENCLAW_GATEWAY_DEVICE_AUTH;
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
    const message =
      typeof parsed.message === 'string'
        ? parsed.message.trim()
        : typeof parsed.error === 'string'
          ? parsed.error.trim()
          : '';

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

  const diagnosticTag = failureStatus === 422 ? 'droplet_capacity_422' : 'gateway_request_failed';
  throw new Error(
    `[${diagnosticTag}] Droplet creation failed (HTTP ${failureStatus}): ${failureBody} ` +
      `[size=${params.size}, region=${params.requestedRegion}, image=${params.image}, attempted_regions=${attemptedRegionSummary}]`,
  );
}

function normalizeGoalList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 5);
}

function countOnboardingAgentSuggestions(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .length;
}

function isJsonObject(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function resetLaunchStateForRetry(onboardingData: Json): Json {
  const nextOnboardingData: Json = {
    ...onboardingData,
    launch_started_at: null,
    launch_completed_at: null,
  };

  const existingV2 = isJsonObject(onboardingData.v2) ? onboardingData.v2 : {};
  const existingLaunch = isJsonObject(existingV2.launch) ? existingV2.launch : {};

  nextOnboardingData.v2 = {
    ...existingV2,
    launch: {
      ...existingLaunch,
      started_at: null,
      completed_at: null,
    },
  };

  return nextOnboardingData;
}

export function buildBootstrapSeedEvidence(params: {
  onboardingData: Json | null | undefined;
  issueId: string | null;
  approvalId: string | null;
  wakeRunId: string | null;
  chiefAgentId: string | null;
  expectedDeviceId: string | null;
  at?: string;
}): Json {
  const onboardingData = params.onboardingData ?? {};
  const starterTask =
    typeof onboardingData.starter_task === 'string' && onboardingData.starter_task.trim().length > 0
      ? onboardingData.starter_task.trim()
      : null;

  return {
    version: '2026-03-24.bootstrap-seed.v1',
    recorded_at: params.at ?? new Date().toISOString(),
    kickoff_issue_id: params.issueId,
    kickoff_approval_id: params.approvalId,
    wake_run_id: params.wakeRunId,
    chief_agent_id: params.chiefAgentId,
    expected_device_id: params.expectedDeviceId,
    starter_task: starterTask,
    onboarding_goals: normalizeGoalList(onboardingData.goals),
    agent_suggestions_count: countOnboardingAgentSuggestions(onboardingData.agent_suggestions),
    workspace_contract: {
      version: WORKSPACE_CONTRACT_VERSION,
      root_prompt_files: [...WORKSPACE_ROOT_PROMPT_FILES],
      memory_contract: WORKSPACE_MEMORY_CONTRACT_VERSION,
    },
  };
}

export function buildStartupCompensationRecord(params: {
  failedAt?: string;
  startupStage: string;
  failureReason: string;
  resources: StartupResourceSnapshot;
}): Json {
  return {
    version: '2026-03-26.startup-compensation.v1',
    policy: 'preserved_for_retry',
    rollback_status: 'tenant_reset_to_draft',
    failed_at: params.failedAt ?? new Date().toISOString(),
    startup_stage: params.startupStage,
    failure_reason: params.failureReason,
    resources: {
      tenant_id: params.resources.tenantId,
      tenant_slug: params.resources.tenantSlug,
      droplet_id: params.resources.dropletId,
      droplet_ip: params.resources.dropletIp,
      workspace_seeded: params.resources.workspaceSeeded,
      paperclip_company_id: params.resources.paperclipCompanyId,
      kickoff_issue_id: params.resources.kickoffIssueId,
      kickoff_approval_id: params.resources.kickoffApprovalId,
      readiness_run_id: params.resources.readinessRunId,
    },
  };
}

export function buildOnboardingKickoffIssueDescription(params: {
  tenantName: string;
  onboardingData: Json | null | undefined;
}): string {
  const onboardingData = params.onboardingData ?? {};
  const companyUrl = typeof onboardingData.company_url === 'string' ? onboardingData.company_url.trim() : '';
  const missionGoals = typeof onboardingData.mission_goals === 'string' ? onboardingData.mission_goals.trim() : '';
  const starterTask = typeof onboardingData.starter_task === 'string' ? onboardingData.starter_task.trim() : '';
  const goals = normalizeGoalList(onboardingData.goals);

  const lines = [
    `Create the first-week execution plan for ${params.tenantName}.`,
    companyUrl ? `Company URL: ${companyUrl}` : 'Company URL: not provided',
    missionGoals ? `Mission goals: ${missionGoals}` : 'Mission goals: not provided',
    starterTask ? `Starter task: ${starterTask}` : 'Starter task: not provided',
    '',
    'Deliverables:',
    '- Draft a concrete 7-day marketing plan.',
    '- Create actionable tasks in Paperclip for the top priorities.',
    '- Generate at least one pending approval for human review.',
  ];

  if (goals.length > 0) {
    lines.push('', 'Onboarding goals:');
    for (const goal of goals) {
      lines.push(`- ${goal}`);
    }
  }

  lines.push('', `Seed tag: ${ONBOARDING_KICKOFF_SEED_TAG}`);
  return lines.join('\n');
}

function getPaperclipAgentHeaders(paperclipApiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${paperclipApiKey}`,
    'Content-Type': 'application/json',
  };
}

function buildOpenClawGatewayWsUrlFromDropletIp(dropletIp: string): string {
  return `ws://${dropletIp}:${OPENCLAW_GATEWAY_DEFAULT_WS_PORT}`;
}

function buildOpenClawGatewayAdapterConfig(params: {
  gatewayWsUrl: string;
  gatewayToken: string;
  existingAdapterConfig?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const disableDeviceAuth = isOpenClawGatewayDeviceAuthDisabled();

  const adapterConfig: Record<string, unknown> = {
    url: params.gatewayWsUrl,
    headers: {
      'x-openclaw-token': params.gatewayToken,
    },
    role: OPENCLAW_GATEWAY_ROLE,
    scopes: [...OPENCLAW_GATEWAY_SCOPES],
    sessionKeyStrategy: OPENCLAW_GATEWAY_SESSION_KEY_STRATEGY,
    waitTimeoutMs: OPENCLAW_GATEWAY_WAIT_TIMEOUT_MS,
    disableDeviceAuth,
  };

  if (!disableDeviceAuth) {
    const deviceIdentity = resolveGatewayDeviceIdentity(params.existingAdapterConfig);
    adapterConfig.deviceId = deviceIdentity.deviceId;
    adapterConfig.devicePrivateKeyPem = deviceIdentity.devicePrivateKeyPem;
  }

  return adapterConfig;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function readGatewayTokenFromAdapterConfig(adapterConfig: Record<string, unknown> | null | undefined): string | null {
  if (!adapterConfig || typeof adapterConfig !== 'object') {
    return null;
  }

  const headers =
    adapterConfig.headers && typeof adapterConfig.headers === 'object'
      ? (adapterConfig.headers as Record<string, unknown>)
      : null;

  if (headers) {
    const headerToken = headers['x-openclaw-token'];
    if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
      return headerToken.trim();
    }
  }

  if (typeof adapterConfig.token === 'string' && adapterConfig.token.trim().length > 0) {
    return adapterConfig.token.trim();
  }

  return null;
}

function readChiefGatewayState(chiefAgent: PaperclipAgentRecord): {
  adapterType: string;
  role: string | null;
  scopes: string[];
  missingScopes: string[];
  gatewayWsUrl: string | null;
  gatewayToken: string | null;
  disableDeviceAuth: boolean | null;
  devicePrivateKeyPem: string | null;
  expectedDeviceId: string | null;
} {
  const adapterType =
    typeof chiefAgent.adapterType === 'string'
      ? chiefAgent.adapterType.trim()
      : '';
  const adapterConfig =
    chiefAgent.adapterConfig && typeof chiefAgent.adapterConfig === 'object'
      ? (chiefAgent.adapterConfig as Record<string, unknown>)
      : null;

  const role = typeof adapterConfig?.role === 'string' ? adapterConfig.role.trim() : null;
  const scopes = normalizeStringArray(adapterConfig?.scopes);
  const missingScopes = OPENCLAW_GATEWAY_SCOPES.filter((scope) => !scopes.includes(scope));
  const gatewayWsUrl = typeof adapterConfig?.url === 'string' ? adapterConfig.url.trim() : null;
  const gatewayToken = readGatewayTokenFromAdapterConfig(adapterConfig);
  const disableDeviceAuth = typeof adapterConfig?.disableDeviceAuth === 'boolean'
    ? adapterConfig.disableDeviceAuth
    : null;
  const devicePrivateKeyPem = readTrimmedString(adapterConfig?.devicePrivateKeyPem);
  const expectedDeviceIdFromConfig = readTrimmedString(adapterConfig?.deviceId)
    ?? readTrimmedString(adapterConfig?.device_id);
  const expectedDeviceId = expectedDeviceIdFromConfig
    ?? (devicePrivateKeyPem ? deriveDeviceIdFromPrivateKeyPem(devicePrivateKeyPem) : null);

  return {
    adapterType,
    role,
    scopes,
    missingScopes,
    gatewayWsUrl,
    gatewayToken,
    disableDeviceAuth,
    devicePrivateKeyPem,
    expectedDeviceId,
  };
}

export function validateChiefGatewayState(
  state: ReturnType<typeof readChiefGatewayState>,
  params: {
    expectedGatewayWsUrl: string;
    expectedGatewayToken: string;
    expectedDisableDeviceAuth: boolean;
  },
): string[] {
  const problems: string[] = [];

  if (state.adapterType !== OPENCLAW_GATEWAY_ADAPTER_TYPE) {
    problems.push(`adapterType=${state.adapterType || 'missing'}`);
  }

  if (state.role !== OPENCLAW_GATEWAY_ROLE) {
    problems.push(`role=${state.role || 'missing'}`);
  }

  if (state.missingScopes.length > 0) {
    problems.push(`missing_scopes=${state.missingScopes.join(',')}`);
  }

  if (state.gatewayWsUrl !== params.expectedGatewayWsUrl) {
    problems.push(`gateway_ws_url=${state.gatewayWsUrl || 'missing'}`);
  }

  if (state.gatewayToken !== params.expectedGatewayToken) {
    problems.push('gateway_token=missing_or_mismatched');
  }

  if (state.disableDeviceAuth !== params.expectedDisableDeviceAuth) {
    problems.push(`disable_device_auth=${String(state.disableDeviceAuth)}`);
  }

  if (!params.expectedDisableDeviceAuth) {
    if (!state.devicePrivateKeyPem) {
      problems.push('device_private_key=missing');
    }
    if (!state.expectedDeviceId) {
      problems.push('device_id=missing');
    }
  }

  return problems;
}

async function loadPaperclipAgentById(params: {
  paperclipUrl: string;
  paperclipApiKey: string;
  agentId: string;
}): Promise<PaperclipAgentRecord> {
  const response = await fetch(`${params.paperclipUrl}/api/agents/${params.agentId}`, {
    headers: getPaperclipAgentHeaders(params.paperclipApiKey),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to fetch Chief agent after adapter patch (HTTP ${response.status}): ` +
      `${summarizeDigitalOceanErrorBody(errorBody)}`,
    );
  }

  return (await response.json()) as PaperclipAgentRecord;
}

function buildChiefAgentCreatePayload(params: {
  gatewayWsUrl: string;
  gatewayToken: string;
}): Record<string, unknown> {
  return {
    name: 'Chief',
    adapterType: OPENCLAW_GATEWAY_ADAPTER_TYPE,
    adapterConfig: buildOpenClawGatewayAdapterConfig(params),
  };
}

async function ensureChiefOpenClawGatewayAdapter(params: {
  paperclipUrl: string;
  paperclipApiKey: string;
  chiefAgent: PaperclipAgentRecord;
  gatewayWsUrl?: string | null;
  gatewayToken?: string | null;
}): Promise<PaperclipAgentRecord> {
  const gatewayWsUrl = typeof params.gatewayWsUrl === 'string' ? params.gatewayWsUrl.trim() : '';
  const gatewayToken = typeof params.gatewayToken === 'string' ? params.gatewayToken.trim() : '';
  const existingState = readChiefGatewayState(params.chiefAgent);
  const desiredDisableDeviceAuth = isOpenClawGatewayDeviceAuthDisabled();
  const requiresDeviceIdentityRepair =
    !desiredDisableDeviceAuth && (!existingState.devicePrivateKeyPem || !existingState.expectedDeviceId);

  const requiresPatch =
    existingState.adapterType !== OPENCLAW_GATEWAY_ADAPTER_TYPE ||
    existingState.role !== OPENCLAW_GATEWAY_ROLE ||
    existingState.missingScopes.length > 0 ||
    existingState.disableDeviceAuth !== desiredDisableDeviceAuth ||
    requiresDeviceIdentityRepair ||
    (gatewayWsUrl && existingState.gatewayWsUrl !== gatewayWsUrl) ||
    (gatewayToken && existingState.gatewayToken !== gatewayToken);

  if (!requiresPatch) {
    return params.chiefAgent;
  }

  if (!gatewayWsUrl || !gatewayToken) {
    throw new Error(
      `Chief adapter requires scope/auth patch but gateway URL/token were missing (adapterType=${existingState.adapterType || 'unknown'})`,
    );
  }

  const patchedAdapterConfig = buildOpenClawGatewayAdapterConfig({
    gatewayWsUrl,
    gatewayToken,
    existingAdapterConfig:
      params.chiefAgent.adapterConfig && typeof params.chiefAgent.adapterConfig === 'object'
        ? params.chiefAgent.adapterConfig as Record<string, unknown>
        : null,
  });

  const patchResponse = await fetch(`${params.paperclipUrl}/api/agents/${params.chiefAgent.id}`, {
    method: 'PATCH',
    headers: getPaperclipAgentHeaders(params.paperclipApiKey),
    body: JSON.stringify({
      adapterType: OPENCLAW_GATEWAY_ADAPTER_TYPE,
      adapterConfig: patchedAdapterConfig,
    }),
  });

  if (!patchResponse.ok) {
    const errorBody = await patchResponse.text();
    throw new Error(
      `Failed to upgrade Chief adapter to openclaw gateway (HTTP ${patchResponse.status}): ` +
      `${summarizeDigitalOceanErrorBody(errorBody)}`,
    );
  }

  const patchedAgent = (await patchResponse.json()) as PaperclipAgentRecord;
  const verifiedAgent = await loadPaperclipAgentById({
    paperclipUrl: params.paperclipUrl,
    paperclipApiKey: params.paperclipApiKey,
    agentId: params.chiefAgent.id,
  });
  const verifiedState = readChiefGatewayState({
    ...params.chiefAgent,
    ...patchedAgent,
    ...verifiedAgent,
  });
  const verificationIssues = validateChiefGatewayState(verifiedState, {
    expectedGatewayWsUrl: gatewayWsUrl,
    expectedGatewayToken: gatewayToken,
    expectedDisableDeviceAuth: desiredDisableDeviceAuth,
  });

  if (verificationIssues.length > 0) {
    throw new Error(
      `Chief adapter patch did not persist required OpenClaw gateway config: ${verificationIssues.join(' | ')}`,
    );
  }

  return {
    ...params.chiefAgent,
    ...patchedAgent,
    ...verifiedAgent,
  };
}

async function seedPaperclipKickoffArtifacts(params: {
  paperclipUrl: string;
  paperclipCompanyId: string;
  paperclipApiKey: string;
  tenantName: string;
  onboardingData: Json | null | undefined;
  gatewayWsUrl?: string | null;
  gatewayToken?: string | null;
}): Promise<{
  chiefAgentId: string;
  expectedDeviceId: string | null;
  createdIssueId: string | null;
  createdApprovalId: string | null;
  wakeRunId: string | null;
}> {
  const headers = getPaperclipAgentHeaders(params.paperclipApiKey);

  const agentsResponse = await fetch(
    `${params.paperclipUrl}/api/companies/${params.paperclipCompanyId}/agents`,
    { headers },
  );
  if (!agentsResponse.ok) {
    throw new Error(`Failed to load Paperclip agents (HTTP ${agentsResponse.status})`);
  }

  const agents = (await agentsResponse.json()) as PaperclipAgentRecord[];
  let chiefAgent = agents.find((agent) => agent.urlKey === 'chief') ?? agents[0];
  if (!chiefAgent?.id) {
    throw new Error('Paperclip company has no available agent for kickoff seed');
  }

  chiefAgent = await ensureChiefOpenClawGatewayAdapter({
    paperclipUrl: params.paperclipUrl,
    paperclipApiKey: params.paperclipApiKey,
    chiefAgent,
    gatewayWsUrl: params.gatewayWsUrl,
    gatewayToken: params.gatewayToken,
  });

  const kickoffIssueTitle = `Onboarding Kickoff — ${params.tenantName}`;
  const existingIssuesResponse = await fetch(
    `${params.paperclipUrl}/api/companies/${params.paperclipCompanyId}/issues?q=${encodeURIComponent(kickoffIssueTitle)}`,
    { headers },
  );

  let kickoffIssueId: string | null = null;
  if (existingIssuesResponse.ok) {
    const existingIssues = (await existingIssuesResponse.json()) as PaperclipIssueRecord[];
    const existingKickoffIssue = existingIssues.find(
      (issue) =>
        typeof issue.id === 'string' &&
        typeof issue.title === 'string' &&
        issue.title.trim().toLowerCase() === kickoffIssueTitle.toLowerCase(),
    );
    if (existingKickoffIssue) {
      kickoffIssueId = existingKickoffIssue.id;
    }
  }

  if (!kickoffIssueId) {
    const kickoffIssueResponse = await fetch(
      `${params.paperclipUrl}/api/companies/${params.paperclipCompanyId}/issues`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: kickoffIssueTitle,
          description: buildOnboardingKickoffIssueDescription({
            tenantName: params.tenantName,
            onboardingData: params.onboardingData,
          }),
          status: 'todo',
          priority: 'high',
        }),
      },
    );

    if (!kickoffIssueResponse.ok) {
      const errorBody = await kickoffIssueResponse.text();
      throw new Error(
        `Failed to seed kickoff issue (HTTP ${kickoffIssueResponse.status}): ${summarizeDigitalOceanErrorBody(errorBody)}`,
      );
    }

    const createdIssue = (await kickoffIssueResponse.json()) as PaperclipIssueRecord;
    kickoffIssueId = typeof createdIssue.id === 'string' ? createdIssue.id : null;
  }

  let wakeRunId: string | null = null;
  const wakeResponse = await fetch(`${params.paperclipUrl}/api/agents/${chiefAgent.id}/wakeup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source: 'on_demand',
      triggerDetail: 'system',
      reason: 'onboarding_kickoff_seed',
      payload: kickoffIssueId
        ? {
            issueId: kickoffIssueId,
            seedTag: ONBOARDING_KICKOFF_SEED_TAG,
          }
        : {
            seedTag: ONBOARDING_KICKOFF_SEED_TAG,
          },
    }),
  });

  if (wakeResponse.ok) {
    const wakePayload = (await wakeResponse.json()) as PaperclipWakeResponse;
    wakeRunId = readWakeRunId(wakePayload);
  }

  const existingApprovalsResponse = await fetch(
    `${params.paperclipUrl}/api/companies/${params.paperclipCompanyId}/approvals?status=pending`,
    { headers },
  );
  let existingKickoffApprovalId: string | null = null;
  if (existingApprovalsResponse.ok) {
    const approvals = (await existingApprovalsResponse.json()) as PaperclipApprovalRecord[];
    const kickoffApproval = approvals.find((approval) => {
      if (!approval.payload || typeof approval.payload !== 'object') {
        return false;
      }
      return approval.payload.seedTag === ONBOARDING_KICKOFF_SEED_TAG;
    });
    if (kickoffApproval?.id) {
      existingKickoffApprovalId = kickoffApproval.id;
    }
  }

  if (existingKickoffApprovalId) {
    return {
      chiefAgentId: chiefAgent.id,
      expectedDeviceId: readChiefGatewayState(chiefAgent).expectedDeviceId,
      createdIssueId: kickoffIssueId,
      createdApprovalId: existingKickoffApprovalId,
      wakeRunId,
    };
  }

  const approvalResponse = await fetch(
    `${params.paperclipUrl}/api/companies/${params.paperclipCompanyId}/approvals`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'approve_ceo_strategy',
        requestedByAgentId: chiefAgent.id,
        issueIds: kickoffIssueId ? [kickoffIssueId] : [],
        payload: {
          seedTag: ONBOARDING_KICKOFF_SEED_TAG,
          title: 'Week 1 Strategy Checkpoint',
          summary: `Initial strategy draft for ${params.tenantName}`,
          requestedAction: 'Approve or request revisions before campaign execution.',
        },
      }),
    },
  );

  if (!approvalResponse.ok) {
    const errorBody = await approvalResponse.text();
    throw new Error(
      `Failed to seed kickoff approval (HTTP ${approvalResponse.status}): ${summarizeDigitalOceanErrorBody(errorBody)}`,
    );
  }

  const createdApproval = (await approvalResponse.json()) as PaperclipApprovalRecord;

  return {
    chiefAgentId: chiefAgent.id,
    expectedDeviceId: readChiefGatewayState(chiefAgent).expectedDeviceId,
    createdIssueId: kickoffIssueId,
    createdApprovalId: typeof createdApproval.id === 'string' ? createdApproval.id : null,
    wakeRunId,
  };
}

function readWakeRunId(payload: PaperclipWakeResponse | null | undefined): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (typeof payload.id === 'string' && payload.id.trim().length > 0) {
    return payload.id.trim();
  }

  if (typeof payload.run?.id === 'string' && payload.run.id.trim().length > 0) {
    return payload.run.id.trim();
  }

  return null;
}

async function triggerChiefWakeupRun(params: {
  paperclipUrl: string;
  paperclipApiKey: string;
  chiefAgentId: string;
  issueId?: string | null;
  reason: string;
}): Promise<string> {
  const wakeResponse = await fetch(`${params.paperclipUrl}/api/agents/${params.chiefAgentId}/wakeup`, {
    method: 'POST',
    headers: getPaperclipAgentHeaders(params.paperclipApiKey),
    body: JSON.stringify({
      source: 'on_demand',
      triggerDetail: 'system',
      reason: params.reason,
      ...(params.issueId
        ? {
            payload: {
              issueId: params.issueId,
              taskId: params.issueId,
            },
          }
        : {}),
    }),
  });

  if (!wakeResponse.ok) {
    const errorBody = await wakeResponse.text();
    throw new Error(
      `Failed to trigger Chief readiness wake (HTTP ${wakeResponse.status}): ${summarizeDigitalOceanErrorBody(errorBody)}`,
    );
  }

  const wakePayload = (await wakeResponse.json()) as PaperclipWakeResponse;
  const runId = readWakeRunId(wakePayload);
  if (!runId) {
    throw new Error('Chief readiness wake did not return a run id');
  }

  return runId;
}

async function loadHeartbeatRunRecord(params: {
  paperclipUrl: string;
  paperclipApiKey: string;
  runId: string;
}): Promise<PaperclipHeartbeatRunRecord> {
  const runResponse = await fetch(`${params.paperclipUrl}/api/heartbeat-runs/${params.runId}`, {
    headers: getPaperclipAgentHeaders(params.paperclipApiKey),
  });

  if (!runResponse.ok) {
    const errorBody = await runResponse.text();
    throw new Error(
      `Failed to read Chief readiness run ${params.runId} (HTTP ${runResponse.status}): ${summarizeDigitalOceanErrorBody(errorBody)}`,
    );
  }

  return (await runResponse.json()) as PaperclipHeartbeatRunRecord;
}

async function loadHeartbeatRunLog(params: {
  paperclipUrl: string;
  paperclipApiKey: string;
  runId: string;
}): Promise<string> {
  try {
    const logResponse = await fetch(
      `${params.paperclipUrl}/api/heartbeat-runs/${params.runId}/log?limitBytes=262144`,
      { headers: getPaperclipAgentHeaders(params.paperclipApiKey) },
    );
    if (!logResponse.ok) {
      return '';
    }
    return await logResponse.text();
  } catch {
    return '';
  }
}

function normalizeRunStatus(rawStatus: unknown): string {
  if (typeof rawStatus !== 'string') {
    return '';
  }

  return rawStatus.trim().toLowerCase();
}

function isRunSucceeded(status: string): boolean {
  return status === 'succeeded' || status === 'success' || status === 'completed' || status === 'complete';
}

function isRunTerminalFailure(status: string): boolean {
  return status === 'failed' || status === 'error' || status === 'timed_out' || status === 'cancelled';
}

function buildReadinessFailureMessage(params: {
  run: PaperclipHeartbeatRunRecord;
  runLog: string;
}): string {
  const detailParts = [
    typeof params.run.errorCode === 'string' ? `errorCode=${params.run.errorCode}` : null,
    typeof params.run.error === 'string' ? `error=${params.run.error}` : null,
    typeof params.run.stderrExcerpt === 'string' ? `stderr=${params.run.stderrExcerpt}` : null,
    typeof params.run.stdoutExcerpt === 'string' ? `stdout=${params.run.stdoutExcerpt}` : null,
    params.runLog.trim() ? `log=${params.runLog.trim()}` : null,
  ].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);

  return detailParts.length > 0
    ? detailParts.join(' | ')
    : 'Chief readiness run failed without diagnostics';
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
    let seededKnowledgeMirrorRevision = 1;
    let startupStage = 'resolve_memory_settings';
    const startupResources: StartupResourceSnapshot = {
      tenantId,
      tenantSlug: tenant.slug,
      dropletId: null,
      dropletIp: null,
      workspaceSeeded: false,
      paperclipCompanyId: null,
      kickoffIssueId: null,
      kickoffApprovalId: null,
      readinessRunId: null,
    };

    const executeProvisioning = async () => {
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

    startupStage = 'resolve_runtime_ingress_plan';
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

    startupStage = 'create_droplet';
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
      const seededKnowledgeMirror = normalizeKnowledgeMirror({
        raw: onboardingData.knowledge_mirror,
        tenantName: tenant.name,
        onboardingData,
      });
      seededKnowledgeMirrorRevision = seededKnowledgeMirror.revision;

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
        onboardingData,
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
    startupResources.dropletId = droplet.dropletId;
    startupResources.workspaceSeeded = true;

    startupStage = 'wait_for_droplet_readiness';
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
      throw new Error('[readiness_timeout] Droplet did not become ready within 5 minutes');
    }
    startupResources.dropletIp = dropletIp;

    startupStage = 'resolve_runtime_ingress';
    const runtimeIngress = await step.run('resolve-runtime-ingress', async () => {
      return resolveRuntimeIngressFromDroplet({
        dropletIp,
        runtimeIngressPlan,
      });
    });

    startupStage = 'create_agentmail_inbox';
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

    startupStage = 'store_infra_refs';
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

    startupStage = 'wait_for_gateway_readiness';
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
      throw new Error('[readiness_timeout] OpenClaw gateway did not become healthy within 10 minutes');
    }

    startupStage = 'verify_gateway_config';
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

    startupStage = 'wait_for_paperclip_health';
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
      throw new Error('[readiness_timeout] Paperclip server did not become healthy within 3 minutes');
    }

    startupStage = 'resolve_paperclip_refs';
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
        startupResources.paperclipCompanyId = refs.companyId;
        break;
      }

      if (i < paperclipRefsMaxAttempts - 1) {
        await step.sleep(`wait-paperclip-refs-${i}`, '5s');
      }
    }

    if (!paperclipCompanyId || !resolvedPaperclipApiKey) {
      throw new Error(
        '[readiness_timeout] Paperclip bootstrap did not persist company/key in time. ' +
        'Check cloud-init logs on the droplet (/var/log/cloud-init-output.log).',
      );
    }

    startupStage = 'store_paperclip_refs';
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

    startupStage = 'create_agent_records';
    await step.run('create-agent-records', async () => {
      const agentName = (onboardingData.agent_name as string) || 'Chief';
      const agentTone = (onboardingData.agent_tone as string) || 'strategic';

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

    startupStage = 'seed_vault';
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

    startupStage = 'send_welcome';
    await step.run('send-welcome', async () => {
      if (!agentmailInbox) {
        return;
      }

      console.log(`Welcome message placeholder for inbox ${agentmailInbox}`);
    });

    startupStage = 'mark_bootstrap_dispatching';
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

    const persistBootstrapFailure = async (stepName: string, lastError: string) => {
      onboardingData = await step.run(stepName, async () => {
        return await persistBootstrapState({
          tenantId,
          onboardingData,
          update: {
            status: 'failed',
            source: 'provisioning',
            lastError,
          },
        });
      });
    };

    startupStage = 'seed_kickoff_artifacts';
    const controlPlaneGatewayWsUrl = buildOpenClawGatewayWsUrlFromDropletIp(dropletIp);
    const chiefGatewayWsUrl = `ws://${OPENCLAW_GATEWAY_DOCKER_HOST_ALIAS}:${OPENCLAW_GATEWAY_DEFAULT_WS_PORT}`;

    const kickoffSeed = await step.run('seed-paperclip-kickoff-artifacts', async () => {
      try {
        const seeded = await seedPaperclipKickoffArtifacts({
          paperclipUrl,
          paperclipCompanyId,
          paperclipApiKey: resolvedPaperclipApiKey,
          tenantName: tenant.name,
          onboardingData,
          gatewayWsUrl: chiefGatewayWsUrl,
          gatewayToken: droplet.gatewayToken,
        });

        return {
          seeded: true,
          chiefAgentId: seeded.chiefAgentId,
          expectedDeviceId: seeded.expectedDeviceId,
          issueId: seeded.createdIssueId,
          approvalId: seeded.createdApprovalId,
          wakeRunId: seeded.wakeRunId,
        };
      } catch (error) {
        console.warn(
          `[provision-tenant] Kickoff seed skipped for tenant ${tenantId}: ` +
            `${error instanceof Error ? error.message : 'Unknown error'}`,
        );

        return {
          seeded: false,
          chiefAgentId: null,
          expectedDeviceId: null,
          issueId: null,
          approvalId: null,
          wakeRunId: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
    startupResources.kickoffIssueId = kickoffSeed.issueId;
    startupResources.kickoffApprovalId = kickoffSeed.approvalId;

    let chiefAgentId = kickoffSeed.chiefAgentId;
    let expectedDeviceId = kickoffSeed.expectedDeviceId;

    if (!chiefAgentId) {
      startupStage = 'resolve_chief_agent_for_readiness';
      const chiefFallback = await step.run('resolve-chief-agent-for-readiness', async () => {
        const agentsResponse = await fetch(
          `${paperclipUrl}/api/companies/${paperclipCompanyId}/agents`,
          { headers: getPaperclipAgentHeaders(resolvedPaperclipApiKey) },
        );
        if (!agentsResponse.ok) {
          throw new Error(`Failed to load agents for readiness preflight (HTTP ${agentsResponse.status})`);
        }

        const agents = (await agentsResponse.json()) as PaperclipAgentRecord[];
        let chiefAgent = agents.find((agent) => agent.urlKey === 'chief') ?? agents[0];
        if (!chiefAgent?.id) {
          throw new Error('No Chief agent available for readiness preflight');
        }

        chiefAgent = await ensureChiefOpenClawGatewayAdapter({
          paperclipUrl,
          paperclipApiKey: resolvedPaperclipApiKey,
          chiefAgent,
          gatewayWsUrl: chiefGatewayWsUrl,
          gatewayToken: droplet.gatewayToken,
        });

        const chiefGatewayState = readChiefGatewayState(chiefAgent);
        return {
          chiefAgentId: chiefAgent.id,
          expectedDeviceId: chiefGatewayState.expectedDeviceId,
        };
      });

      chiefAgentId = chiefFallback.chiefAgentId;
      expectedDeviceId = chiefFallback.expectedDeviceId;
    }

    let readinessRunId = kickoffSeed.wakeRunId;
    if (!readinessRunId) {
      startupStage = 'trigger_chief_readiness_run';
      readinessRunId = await step.run('trigger-chief-readiness-run', async () => {
        return await triggerChiefWakeupRun({
          paperclipUrl,
          paperclipApiKey: resolvedPaperclipApiKey,
          chiefAgentId,
          issueId: kickoffSeed.issueId,
          reason: 'provisioning_readiness_preflight',
        });
      });
    }
    startupResources.readinessRunId = readinessRunId;

    startupStage = 'wait_for_chief_readiness';
    const readinessMaxAttempts = 40; // ~200 seconds, bounded by step sleep
    const maxRetryRuns = 2;
    let readinessPassed = false;
    let retryRunsUsed = 0;
    let lastReadinessFailure = '';

    for (let i = 0; i < readinessMaxAttempts; i += 1) {
      const run = await step.run(`check-chief-readiness-run-${i}`, async () => {
        return await loadHeartbeatRunRecord({
          paperclipUrl,
          paperclipApiKey: resolvedPaperclipApiKey,
          runId: readinessRunId,
        });
      });

      const normalizedStatus = normalizeRunStatus(run.status);
      if (isRunSucceeded(normalizedStatus)) {
        readinessPassed = true;
        break;
      }

      if (isRunTerminalFailure(normalizedStatus)) {
        const runLog = await step.run(`load-chief-readiness-log-${i}`, async () => {
          return await loadHeartbeatRunLog({
            paperclipUrl,
            paperclipApiKey: resolvedPaperclipApiKey,
            runId: readinessRunId,
          });
        });

        const failureMessage = buildReadinessFailureMessage({ run, runLog });
        const diagnostics = classifyGatewayFailure({
          status: 502,
          message: failureMessage,
        });
        lastReadinessFailure = formatGatewayDiagnostic(diagnostics);

        let shouldRetryRun = false;

        if (isPairingRecoveryEligible(diagnostics) && retryRunsUsed < maxRetryRuns) {
          const pairingApproval = await step.run(`approve-chief-pairing-${i}`, async () => {
            return await autoApproveGatewayPairing({
              gatewayWsUrl: controlPlaneGatewayWsUrl,
              gatewayToken: droplet.gatewayToken,
              requestId: diagnostics.requestId,
              expectedDeviceId,
            });
          });

          if (pairingApproval.ok) {
            shouldRetryRun = true;
          } else {
            const shouldTrySshPairingFallback =
              diagnostics.missingScope === 'operator.pairing'
              || pairingApproval.reason.toLowerCase().includes('missing scope: operator.pairing');

            if (shouldTrySshPairingFallback) {
              const sshPairingApproval = await step.run(`approve-chief-pairing-ssh-${i}`, async () => {
                return await approveGatewayPairingViaSsh({
                  host: dropletIp,
                  gatewayToken: droplet.gatewayToken,
                  requestId: diagnostics.requestId,
                  expectedDeviceId,
                });
              });

              if (sshPairingApproval.ok) {
                shouldRetryRun = true;
              } else {
                lastReadinessFailure =
                  `${lastReadinessFailure} | autoPair=${pairingApproval.reason} sshPair=${sshPairingApproval.reason}`;
              }
            } else {
              lastReadinessFailure = `${lastReadinessFailure} | autoPair=${pairingApproval.reason}`;
            }
          }
        } else if (diagnostics.retryable && retryRunsUsed < maxRetryRuns) {
          shouldRetryRun = true;
        }

        if (shouldRetryRun) {
          retryRunsUsed += 1;
          startupStage = 'retry_chief_readiness_run';
          readinessRunId = await step.run(`retry-chief-readiness-run-${i}`, async () => {
            return await triggerChiefWakeupRun({
              paperclipUrl,
              paperclipApiKey: resolvedPaperclipApiKey,
              chiefAgentId,
              issueId: kickoffSeed.issueId,
              reason: `provisioning_readiness_retry_${retryRunsUsed}`,
            });
          });
          startupResources.readinessRunId = readinessRunId;
          continue;
        }

        await persistBootstrapFailure('persist-bootstrap-failure-readiness', lastReadinessFailure);
        throw new Error(lastReadinessFailure);
      }

      if (i < readinessMaxAttempts - 1) {
        await step.sleep(`wait-chief-readiness-run-${i}`, '5s');
      }
    }

    if (!readinessPassed) {
      const timeoutMessage = lastReadinessFailure
        ? `[readiness_timeout] Chief readiness run did not succeed: ${lastReadinessFailure}`
        : '[readiness_timeout] Chief readiness run did not reach success before timeout';
      await persistBootstrapFailure('persist-bootstrap-failure-readiness-timeout', timeoutMessage);
      throw new Error(timeoutMessage);
    }

    onboardingData = await step.run('persist-bootstrap-seed-evidence', async (): Promise<Json> => {
      const nextOnboardingData = {
        ...onboardingData,
        bootstrap_seed: buildBootstrapSeedEvidence({
          onboardingData,
          issueId: kickoffSeed.issueId,
          approvalId: kickoffSeed.approvalId,
          wakeRunId: readinessRunId,
          chiefAgentId,
          expectedDeviceId,
        }),
      };

      const { data, error } = await supabase
        .from('tenants')
        .update({ onboarding_data: nextOnboardingData })
        .eq('id', tenantId)
        .select('onboarding_data')
        .single();

      if (error) {
        throw new Error(`Failed to persist bootstrap seed evidence: ${error.message}`);
      }

      return (data?.onboarding_data as Json | null) ?? nextOnboardingData;
    });

    startupStage = 'mark_bootstrap_accepted';
    onboardingData = await step.run('persist-bootstrap-readiness-accepted', async () => {
      return await persistBootstrapState({
        tenantId,
        onboardingData,
        update: {
          status: 'accepted',
          source: 'provisioning',
        },
      });
    });

    startupStage = 'mark_tenant_active';
    const activationState = await step.run('mark-active', async () => {
      const { data: latestTenantData, error: latestTenantError } = await supabase
        .from('tenants')
        .select('onboarding_data')
        .eq('id', tenantId)
        .single();

      if (latestTenantError) {
        throw new Error(`Failed to load latest onboarding data before activation: ${latestTenantError.message}`);
      }

      const latestOnboardingData = (latestTenantData?.onboarding_data ?? {}) as Json;
      const activationMirrorState = resolveKnowledgeMirrorActivationState({
        onboardingData: latestOnboardingData,
        tenantName: tenant.name,
        seededRevision: seededKnowledgeMirrorRevision,
      });
      const nextOnboardingData = withKnowledgeMirror(latestOnboardingData, activationMirrorState.mirror);

      const { error } = await supabase
        .from('tenants')
        .update({ status: 'active', onboarding_data: nextOnboardingData })
        .eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to mark tenant as active: ${error.message}`);
      }

      onboardingData = nextOnboardingData;

      return {
        currentRevision: activationMirrorState.currentRevision,
        seededRevision: activationMirrorState.seededRevision,
        needsCatchupSync: activationMirrorState.needsCatchupSync,
      };
    });

    let activationKnowledgeSyncQueued = false;
    let activationKnowledgeSyncError: string | null = null;
    if (activationState.needsCatchupSync) {
      startupStage = 'enqueue_knowledge_sync_catchup';
      try {
        await step.run('enqueue-knowledge-sync-catchup', async () => {
          await inngest.send({
            name: KNOWLEDGE_SYNC_REQUESTED_EVENT,
            data: {
              tenantId,
              revision: activationState.currentRevision,
            },
          });
        });
        activationKnowledgeSyncQueued = true;
      } catch (error) {
        activationKnowledgeSyncError = `Activation catch-up sync enqueue failed: ${toErrorMessage(error)}`;
        await step.run('persist-activation-sync-enqueue-failure', async () => {
          const { data: latestTenantData, error: latestTenantError } = await supabase
            .from('tenants')
            .select('onboarding_data')
            .eq('id', tenantId)
            .single();

          if (latestTenantError) {
            throw new Error(`Failed to load onboarding data after sync enqueue failure: ${latestTenantError.message}`);
          }

          const latestOnboardingData = (latestTenantData?.onboarding_data ?? {}) as Json;
          const latestMirror = normalizeKnowledgeMirror({
            raw: latestOnboardingData.knowledge_mirror,
            tenantName: tenant.name,
            onboardingData: latestOnboardingData,
          });
          const failedMirror = markKnowledgeMirrorSyncFailed({
            mirror: latestMirror,
            error: activationKnowledgeSyncError || 'Activation catch-up sync enqueue failed',
          });
          const nextOnboardingData = withKnowledgeMirror(latestOnboardingData, failedMirror);

          const { error: updateError } = await supabase
            .from('tenants')
            .update({ onboarding_data: nextOnboardingData })
            .eq('id', tenantId);

          if (updateError) {
            throw new Error(`Failed to persist activation sync enqueue failure: ${updateError.message}`);
          }
        });
      }
    }
    startupStage = 'completed';

    return {
      success: true,
      tenantId,
      dropletId: droplet.dropletId,
      dropletIp,
      agentmailInbox,
      bootstrapAccepted: true,
      bootstrapStatus: 'readiness_passed',
      bootstrapDiagnostics: null,
      bootstrapAutoPairAttempted: false,
      bootstrapAutoPairApproved: false,
      startupRoute: 'paperclip_kickoff_wakeup',
      knowledgeSeededRevision: activationState.seededRevision,
      knowledgeCurrentRevision: activationState.currentRevision,
      knowledgeCatchupPending: activationState.needsCatchupSync,
      knowledgeCatchupQueued: activationKnowledgeSyncQueued,
      knowledgeCatchupQueueError: activationKnowledgeSyncError,
      memoryNativeEnabled: memoryProvisioningPlan.effectiveNativeEnabled,
      memoryNativeDowngraded: memoryProvisioningPlan.nativeDowngradedMissingApiKey,
      trialMode: !!trialMode,
      requestedSize: droplet.requestedSize,
      requestedRegion: droplet.requestedRegion,
    };
    };

    try {
      return await executeProvisioning();
    } catch (error) {
      const failureReason = toErrorMessage(error);
      const failedAt = new Date().toISOString();
      const compensation = buildStartupCompensationRecord({
        failedAt,
        startupStage,
        failureReason,
        resources: startupResources,
      });

      console.warn(
        `[provision-tenant] Startup failed for tenant ${tenantId} at stage ${startupStage}: ${failureReason}`,
      );

      await step.run('persist-startup-failure-and-rollback', async () => {
        const failedBootstrapOnboardingData = await persistBootstrapState({
          tenantId,
          onboardingData,
          update: {
            status: 'failed',
            source: 'provisioning',
            lastError: failureReason,
            at: failedAt,
          },
        });

        const compensationOnboardingData = resetLaunchStateForRetry({
          ...failedBootstrapOnboardingData,
          startup_compensation: compensation,
        });

        const { data: rolledBackTenant, error: rollbackError } = await supabase
          .from('tenants')
          .update({
            status: 'draft',
            onboarding_data: compensationOnboardingData,
          })
          .eq('id', tenantId)
          .eq('status', 'provisioning')
          .select('status')
          .maybeSingle();

        if (rollbackError) {
          throw new Error(`Failed to rollback tenant to draft after startup failure: ${rollbackError.message}`);
        }

        if (!rolledBackTenant) {
          const { data: latestTenant, error: latestTenantError } = await supabase
            .from('tenants')
            .select('status')
            .eq('id', tenantId)
            .single();

          if (latestTenantError) {
            throw new Error(
              `Failed to verify tenant status after startup failure rollback miss: ${latestTenantError.message}`,
            );
          }

          if (latestTenant?.status !== 'draft') {
            throw new Error(
              `Startup rollback did not land in draft (current status: ${latestTenant?.status ?? 'unknown'})`,
            );
          }
        }

        onboardingData = compensationOnboardingData;
      });

      return {
        success: false,
        tenantId,
        startupFailed: true,
        startupStage,
        startupError: failureReason,
        rolledBackToDraft: true,
        compensationPolicy: 'preserved_for_retry',
      };
    }
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

export function resolveKnowledgeMirrorActivationState(params: {
  onboardingData: Json;
  tenantName: string;
  seededRevision: number;
}) {
  const latestMirror = normalizeKnowledgeMirror({
    raw: params.onboardingData.knowledge_mirror,
    tenantName: params.tenantName,
    onboardingData: params.onboardingData,
  });
  const mirrorWithSeededRevision = markKnowledgeMirrorSeededRevision({
    mirror: latestMirror,
    seededRevision: params.seededRevision,
  });
  const currentRevisionMatchesSeed = latestMirror.revision === params.seededRevision;
  const activationMirror = currentRevisionMatchesSeed
    ? markKnowledgeMirrorSynced({
      mirror: mirrorWithSeededRevision,
      syncedRevision: params.seededRevision,
    })
    : markKnowledgeMirrorPending({
      mirror: mirrorWithSeededRevision,
      clearError: true,
    });

  return {
    mirror: activationMirror,
    currentRevision: activationMirror.revision,
    seededRevision: params.seededRevision,
    needsCatchupSync: !currentRevisionMatchesSeed,
  };
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
  const agentName = (params.onboardingData.agent_name as string) || 'Chief';
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
  const chiefAgentCreatePayload = JSON.stringify(
    buildChiefAgentCreatePayload({
      gatewayWsUrl: `ws://${OPENCLAW_GATEWAY_DOCKER_HOST_ALIAS}:${OPENCLAW_GATEWAY_DEFAULT_WS_PORT}`,
      gatewayToken: params.gatewayToken,
    }),
  ).replace(/'/g, "'\\''");

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
  -d '${chiefAgentCreatePayload}' || echo '{}')
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
  --add-host ${OPENCLAW_GATEWAY_DOCKER_HOST_ALIAS}:host-gateway \\
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

# Ensure authenticated Paperclip is healthy before publishing refs to control plane.
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3100/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -sf http://127.0.0.1:3100/api/health >/dev/null 2>&1; then
  echo "Authenticated Paperclip did not become healthy within 60s" >&2
  docker logs paperclip >&2 || true
  exit 1
fi

# Keep OpenClaw env aligned with the generated Paperclip API key and write
# every claimed-key path the runtime currently probes.
persist_openclaw_claimed_api_keys() {
  local attempts=0
  local claimed_at
  claimed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  while true; do
    if docker exec -u 0 -e API_TOKEN="$API_TOKEN" -e CLAIMED_AT="$claimed_at" openclaw-gateway sh -lc '
      set -e
      mkdir -p /home/node/.openclaw /home/node/.openclaw/workspace /home/node/.openclaw/workspace-main
      for target in \
        /home/node/.openclaw/workspace-main-claimed-api-key.json \
        /home/node/.openclaw/workspace[]-claimed-api-key.json \
        /home/node/.openclaw/workspace/paperclip-claimed-api-key.json \
        /home/node/.openclaw/workspace-main/paperclip-claimed-api-key.json
      do
        cat > "$target" <<JSON
{"apiKey":"\${API_TOKEN}","claimedAt":"\${CLAIMED_AT}"}
JSON
        chown 1000:1000 "$target"
        chmod 600 "$target"
      done
    '; then
      return 0
    fi

    attempts=$((attempts + 1))
    if [ "$attempts" -ge 10 ]; then
      echo "Failed to persist OpenClaw claimed API key files" >&2
      return 1
    fi

    sleep 2
  done
}

if [ -f /opt/openclaw/.env ]; then
  sed -i.bak "s/^PAPERCLIP_API_KEY=.*/PAPERCLIP_API_KEY=$API_TOKEN/" /opt/openclaw/.env
  docker restart openclaw-gateway >/dev/null
  persist_openclaw_claimed_api_keys
fi

# Publish Paperclip refs only after runtime + claimed key artifacts are ready.
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
        skipBootstrap: true,
        model: {
          primary: 'openai/gpt-5.4',
          fallbacks: ['google/gemini-2.5-flash', 'openai/gpt-4o-mini'],
        },
        heartbeat: {
          every: '0m',
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
