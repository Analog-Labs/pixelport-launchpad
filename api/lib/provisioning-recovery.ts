import { createClient } from '@supabase/supabase-js';
import type { Tenant } from './auth';

type RecoveryResult = {
  tenant: Tenant;
  recovered: boolean;
  reason: string;
};

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

function hasRecoveryPrerequisites(tenant: Tenant): boolean {
  return (
    tenant.status?.trim().toLowerCase() === 'provisioning'
    && !!tenant.droplet_ip
    && (!!tenant.paperclip_api_key || !!tenant.agent_api_key || !!tenant.gateway_token)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readCompanyIdFromPayload(payload: unknown): string | null {
  if (Array.isArray(payload)) {
    const first = payload.find((item) => isRecord(item) && typeof item.id === 'string') as
      | Record<string, unknown>
      | undefined;
    return typeof first?.id === 'string' ? first.id : null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const candidates = [
    payload.company,
    payload.data,
    payload.companies,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const first = candidate.find((item) => isRecord(item) && typeof item.id === 'string') as
        | Record<string, unknown>
        | undefined;
      if (typeof first?.id === 'string') {
        return first.id;
      }
    } else if (isRecord(candidate) && typeof candidate.id === 'string') {
      return candidate.id;
    }
  }

  if (typeof payload.id === 'string') {
    return payload.id;
  }

  return null;
}

async function resolveWorkingPaperclipAuthKey(tenant: Tenant): Promise<string | null> {
  const candidateKeys = [
    tenant.paperclip_api_key,
    tenant.agent_api_key,
    tenant.gateway_token,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const paperclipUrl = `http://${tenant.droplet_ip}:3100`;
  for (const key of candidateKeys) {
    try {
      const res = await fetch(`${paperclipUrl}/api/health`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        return key;
      }
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

async function discoverOrCreatePaperclipCompany(tenant: Tenant, authKey: string): Promise<string | null> {
  const paperclipUrl = `http://${tenant.droplet_ip}:3100`;
  const headers = {
    Authorization: `Bearer ${authKey}`,
    'Content-Type': 'application/json',
  };

  // 1. Discover existing company.
  const listRes = await fetch(`${paperclipUrl}/api/companies`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (listRes.ok) {
    const payload = await listRes.json();
    const existingCompanyId = readCompanyIdFromPayload(payload);
    if (existingCompanyId) {
      return existingCompanyId;
    }
  }

  // 2. Create if missing.
  const createRes = await fetch(`${paperclipUrl}/api/companies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: tenant.name }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!createRes.ok) {
    return null;
  }

  const createdPayload = await createRes.json();
  return readCompanyIdFromPayload(createdPayload);
}

export async function tryRecoverProvisioningTenant(tenant: Tenant): Promise<RecoveryResult> {
  if (!hasRecoveryPrerequisites(tenant)) {
    return { tenant, recovered: false, reason: 'not-eligible' };
  }

  if (!supabase) {
    return { tenant, recovered: false, reason: 'missing-supabase-env' };
  }

  try {
    const authKey = await resolveWorkingPaperclipAuthKey(tenant);
    if (!authKey) {
      return { tenant, recovered: false, reason: 'paperclip-auth-unavailable' };
    }

    const companyId = await discoverOrCreatePaperclipCompany(tenant, authKey);
    if (!companyId) {
      return { tenant, recovered: false, reason: 'paperclip-not-ready' };
    }

    const updates: Partial<Tenant> = {
      status: 'active',
      paperclip_company_id: companyId,
      paperclip_api_key: tenant.paperclip_api_key ?? authKey,
    };

    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenant.id)
      .select('*')
      .single();

    if (error || !data) {
      return { tenant, recovered: false, reason: 'tenant-update-failed' };
    }

    return { tenant: data as Tenant, recovered: true, reason: 'recovered' };
  } catch (error) {
    console.warn(
      `[provisioning-recovery] tenant ${tenant.id} recovery failed:`,
      error instanceof Error ? error.message : String(error),
    );
    return { tenant, recovered: false, reason: 'recovery-exception' };
  }
}
