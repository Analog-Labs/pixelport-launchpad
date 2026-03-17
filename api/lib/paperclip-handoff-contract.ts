import { createHmac, randomUUID } from 'crypto';
import { isIP } from 'net';

export const PAPERCLIP_HANDOFF_CONTRACT_VERSION = 'p1-v1';
export const DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS = 300;
export const PAPERCLIP_RUNTIME_PORT = 18789;

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
