import { createHmac, randomUUID } from 'crypto';
import { isIP } from 'net';

export const PAPERCLIP_HANDOFF_CONTRACT_VERSION = 'p1-v1';
export const DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS = 300;
export const PAPERCLIP_RUNTIME_PORT = 18789;
export const PAPERCLIP_RUNTIME_HANDOFF_PATH = '/pixelport/handoff';

const PAPERCLIP_HANDOFF_READY_STATUSES = new Set(['ready', 'active']);

export interface PaperclipHandoffPayload {
  v: string;
  iss: 'pixelport-launchpad';
  aud: 'paperclip-runtime';
  iat: number;
  exp: number;
  jti: string;
  source: string;
  user_id: string;
  tenant_id: string;
  tenant_slug: string;
  tenant_status: string;
  tenant_plan: string;
}

export interface PaperclipHandoffConfig {
  handoffSecret: string;
  ttlSeconds: number;
}

export class PaperclipHandoffConfigError extends Error {
  code: 'missing_env';
  fields: string[];

  constructor(
    message: string,
    code: 'missing_env',
    fields: string[],
  ) {
    super(message);
    this.name = 'PaperclipHandoffConfigError';
    this.code = code;
    this.fields = fields;
  }
}

function normalizeEnvValue(value: string | undefined): string {
  return value?.trim() || '';
}

export function isPaperclipHandoffReadyStatus(status: string | null | undefined): boolean {
  if (typeof status !== 'string') {
    return false;
  }

  return PAPERCLIP_HANDOFF_READY_STATUSES.has(status.trim().toLowerCase());
}

export function resolvePaperclipHandoffTtlSeconds(rawValue: string | undefined): number {
  const normalized = normalizeEnvValue(rawValue);
  if (!normalized) {
    return DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS;
  }

  return Math.min(parsed, 3600);
}

function normalizeDropletIp(rawDropletIp: string | null | undefined): string {
  if (typeof rawDropletIp !== 'string') {
    return '';
  }

  return rawDropletIp.trim();
}

function normalizeRuntimeUrl(rawValue: unknown, requireHttps: boolean): string | null {
  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = rawValue.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (requireHttps && parsed.protocol !== 'https:') {
      return null;
    }

    if (!requireHttps && parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
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

function isValidRuntimeSlugLabel(rawSlug: string | null | undefined): boolean {
  if (typeof rawSlug !== 'string') {
    return false;
  }

  const slug = rawSlug.trim().toLowerCase();
  if (!slug || slug.length > 63) {
    return false;
  }

  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug);
}

export function resolvePaperclipRuntimeUrlFromTenantDomain(
  rawTenantSlug: string | null | undefined,
  rawBaseDomain: string | undefined,
): string | null {
  if (!isValidRuntimeSlugLabel(rawTenantSlug)) {
    return null;
  }

  const baseDomain = normalizeRuntimeBaseDomain(rawBaseDomain);
  if (!baseDomain) {
    return null;
  }

  return normalizeRuntimeUrl(`https://${rawTenantSlug!.trim().toLowerCase()}.${baseDomain}`, true);
}

export function resolvePaperclipRuntimeUrlFromOnboardingData(onboardingData: unknown): string | null {
  if (!onboardingData || typeof onboardingData !== 'object' || Array.isArray(onboardingData)) {
    return null;
  }

  const record = onboardingData as Record<string, unknown>;
  const runtimeCandidates = [
    record.runtime_https_url,
    record.runtime_url,
  ];

  for (const candidate of runtimeCandidates) {
    const normalized = normalizeRuntimeUrl(candidate, false);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function resolvePaperclipRuntimeUrl(params: {
  onboardingData?: unknown;
  tenantSlug?: string | null;
  dropletIp?: string | null;
  runtimeBaseDomain?: string | undefined;
}): string | null {
  const fromOnboardingData = resolvePaperclipRuntimeUrlFromOnboardingData(params.onboardingData);
  if (fromOnboardingData) {
    return fromOnboardingData;
  }

  const fromTenantDomain = resolvePaperclipRuntimeUrlFromTenantDomain(
    params.tenantSlug ?? null,
    params.runtimeBaseDomain,
  );
  if (fromTenantDomain) {
    return fromTenantDomain;
  }

  return resolvePaperclipRuntimeUrlFromDropletIp(params.dropletIp ?? null);
}

// V1/V1.1 NOTE: prefer HTTPS tenant runtime URLs when configured; fallback to plaintext HTTP droplet IP for compatibility.
export function resolvePaperclipRuntimeUrlFromDropletIp(rawDropletIp: string | null | undefined): string | null {
  const dropletIp = normalizeDropletIp(rawDropletIp);
  if (!dropletIp) {
    return null;
  }

  const ipVersion = isIP(dropletIp);
  if (ipVersion === 0) {
    return null;
  }

  const host = ipVersion === 6 ? `[${dropletIp}]` : dropletIp;
  return `http://${host}:${PAPERCLIP_RUNTIME_PORT}`;
}

function normalizeGatewayToken(rawGatewayToken: string | null | undefined): string {
  if (typeof rawGatewayToken !== 'string') {
    return '';
  }
  return rawGatewayToken.trim();
}

export function buildGatewayControlUiLaunchUrl(
  runtimeUrl: string | null,
  rawGatewayToken: string | null | undefined,
): string | null {
  if (!runtimeUrl) {
    return null;
  }

  const gatewayToken = normalizeGatewayToken(rawGatewayToken);
  if (!gatewayToken) {
    return null;
  }

  try {
    const launchUrl = new URL(runtimeUrl);
    if (launchUrl.protocol !== 'http:' && launchUrl.protocol !== 'https:') {
      return null;
    }

    launchUrl.hash = `token=${encodeURIComponent(gatewayToken)}`;
    return launchUrl.toString();
  } catch {
    return null;
  }
}

function normalizeHandoffToken(rawHandoffToken: string | null | undefined): string {
  if (typeof rawHandoffToken !== 'string') {
    return '';
  }

  return rawHandoffToken.trim();
}

export function buildPaperclipRuntimeHandoffUrl(
  runtimeUrl: string | null,
  rawHandoffToken: string | null | undefined,
): string | null {
  if (!runtimeUrl) {
    return null;
  }

  const handoffToken = normalizeHandoffToken(rawHandoffToken);
  if (!handoffToken) {
    return null;
  }

  try {
    const handoffUrl = new URL(PAPERCLIP_RUNTIME_HANDOFF_PATH, runtimeUrl);
    if (handoffUrl.protocol !== 'http:' && handoffUrl.protocol !== 'https:') {
      return null;
    }

    handoffUrl.search = '';
    handoffUrl.hash = '';
    handoffUrl.searchParams.set('handoff_token', handoffToken);
    handoffUrl.searchParams.set('next', '/');
    return handoffUrl.toString();
  } catch {
    return null;
  }
}

export async function isPaperclipRuntimeHandoffRouteActive(
  runtimeUrl: string | null,
): Promise<boolean> {
  if (!runtimeUrl) {
    return false;
  }

  let probeUrl: URL;
  try {
    probeUrl = new URL(PAPERCLIP_RUNTIME_HANDOFF_PATH, runtimeUrl);
  } catch {
    return false;
  }

  // Probe only HTTPS runtime hosts to avoid adding latency/noise on HTTP compatibility endpoints.
  if (probeUrl.protocol !== 'https:') {
    return false;
  }

  probeUrl.searchParams.set('handoff_token', 'probe.invalid');
  probeUrl.searchParams.set('next', '/');

  const timeoutSignal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(2_000)
      : undefined;

  try {
    const response = await fetch(probeUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: timeoutSignal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status !== 400 && response.status !== 401 && response.status !== 503) {
      return false;
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.includes('application/json')) {
      return false;
    }

    const body = (await response.text()).toLowerCase();
    return body.includes('handoff_token')
      || body.includes('invalid handoff token')
      || body.includes('paperclip_handoff_secret');
  } catch {
    return false;
  }
}

export function getMissingPaperclipHandoffEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];

  if (!normalizeEnvValue(env.PAPERCLIP_HANDOFF_SECRET)) {
    missing.push('PAPERCLIP_HANDOFF_SECRET');
  }

  return missing;
}

export function resolvePaperclipHandoffConfig(env: NodeJS.ProcessEnv = process.env): PaperclipHandoffConfig {
  const missing = getMissingPaperclipHandoffEnv(env);
  if (missing.length > 0) {
    throw new PaperclipHandoffConfigError(
      `Missing required handoff env vars: ${missing.join(', ')}`,
      'missing_env',
      missing,
    );
  }

  return {
    handoffSecret: normalizeEnvValue(env.PAPERCLIP_HANDOFF_SECRET),
    ttlSeconds: resolvePaperclipHandoffTtlSeconds(env.PAPERCLIP_HANDOFF_TTL_SECONDS),
  };
}

export function buildPaperclipHandoffPayload(params: {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  tenantStatus: string;
  tenantPlan: string;
  source: string;
  ttlSeconds: number;
  nowEpochSeconds?: number;
}): PaperclipHandoffPayload {
  const nowEpochSeconds = params.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const expiresAt = nowEpochSeconds + params.ttlSeconds;

  return {
    v: PAPERCLIP_HANDOFF_CONTRACT_VERSION,
    iss: 'pixelport-launchpad',
    aud: 'paperclip-runtime',
    iat: nowEpochSeconds,
    exp: expiresAt,
    jti: randomUUID(),
    source: params.source,
    user_id: params.userId,
    tenant_id: params.tenantId,
    tenant_slug: params.tenantSlug,
    tenant_status: params.tenantStatus,
    tenant_plan: params.tenantPlan,
  };
}

export function signPaperclipHandoffPayload(
  payload: PaperclipHandoffPayload,
  handoffSecret: string,
): string {
  const serializedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', handoffSecret)
    .update(serializedPayload)
    .digest('base64url');

  return `${serializedPayload}.${signature}`;
}
