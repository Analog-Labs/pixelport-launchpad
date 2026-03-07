import { supabase } from './supabase';

type JsonRecord = Record<string, unknown>;

const BOOTSTRAP_STATUSES = ['not_started', 'dispatching', 'accepted', 'completed', 'failed'] as const;
const BOOTSTRAP_SOURCES = ['provisioning', 'dashboard_replay', 'manual_force'] as const;

export type BootstrapStatus = (typeof BOOTSTRAP_STATUSES)[number];
export type BootstrapSource = (typeof BOOTSTRAP_SOURCES)[number];

export type BootstrapState = {
  status: BootstrapStatus;
  source: BootstrapSource | null;
  requested_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  last_error: string | null;
};

export type BootstrapSnapshot = {
  onboardingData: JsonRecord;
  state: BootstrapState;
  updatedAt: string;
};

type BootstrapStateUpdate = {
  status: Exclude<BootstrapStatus, 'not_started'>;
  source?: BootstrapSource;
  lastError?: string | null;
  at?: string;
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asBootstrapStatus(value: unknown): BootstrapStatus | null {
  return typeof value === 'string' && BOOTSTRAP_STATUSES.includes(value as BootstrapStatus)
    ? (value as BootstrapStatus)
    : null;
}

function asBootstrapSource(value: unknown): BootstrapSource | null {
  return typeof value === 'string' && BOOTSTRAP_SOURCES.includes(value as BootstrapSource)
    ? (value as BootstrapSource)
    : null;
}

export function cloneOnboardingData(onboardingData: JsonRecord | null | undefined): JsonRecord {
  return isJsonRecord(onboardingData) ? { ...onboardingData } : {};
}

export function getBootstrapState(onboardingData: JsonRecord | null | undefined): BootstrapState {
  const root = cloneOnboardingData(onboardingData);
  const bootstrap = isJsonRecord(root.bootstrap) ? root.bootstrap : {};

  return {
    status: asBootstrapStatus(bootstrap.status) ?? 'not_started',
    source: asBootstrapSource(bootstrap.source),
    requested_at: typeof bootstrap.requested_at === 'string' ? bootstrap.requested_at : null,
    accepted_at: typeof bootstrap.accepted_at === 'string' ? bootstrap.accepted_at : null,
    completed_at: typeof bootstrap.completed_at === 'string' ? bootstrap.completed_at : null,
    last_error: typeof bootstrap.last_error === 'string' ? bootstrap.last_error : null,
  };
}

export function buildOnboardingDataWithBootstrapState(
  onboardingData: JsonRecord | null | undefined,
  update: BootstrapStateUpdate
): JsonRecord {
  const nextOnboardingData = cloneOnboardingData(onboardingData);
  const currentState = getBootstrapState(onboardingData);
  const now = update.at ?? new Date().toISOString();

  const nextBootstrap: JsonRecord = {
    status: update.status,
    source: update.source ?? currentState.source ?? 'provisioning',
    requested_at: currentState.requested_at,
    accepted_at: currentState.accepted_at,
    completed_at: currentState.completed_at,
    last_error: currentState.last_error,
  };

  if (update.status === 'dispatching') {
    nextBootstrap.requested_at = now;
    nextBootstrap.accepted_at = null;
    nextBootstrap.completed_at = null;
    nextBootstrap.last_error = null;
  } else if (update.status === 'accepted') {
    nextBootstrap.requested_at = currentState.requested_at ?? now;
    nextBootstrap.accepted_at = now;
    nextBootstrap.completed_at = null;
    nextBootstrap.last_error = null;
  } else if (update.status === 'completed') {
    nextBootstrap.requested_at = currentState.requested_at ?? now;
    nextBootstrap.accepted_at = currentState.accepted_at ?? now;
    nextBootstrap.completed_at = now;
    nextBootstrap.last_error = null;
  } else if (update.status === 'failed') {
    nextBootstrap.requested_at = currentState.requested_at ?? now;
    nextBootstrap.accepted_at = null;
    nextBootstrap.completed_at = null;
    nextBootstrap.last_error = update.lastError ?? 'Unknown bootstrap error';
  }

  nextOnboardingData.bootstrap = nextBootstrap;

  return nextOnboardingData;
}

function buildSnapshot(onboardingData: JsonRecord | null | undefined, updatedAt: string): BootstrapSnapshot {
  return {
    onboardingData: cloneOnboardingData(onboardingData),
    state: getBootstrapState(onboardingData),
    updatedAt,
  };
}

export async function loadBootstrapSnapshot(params: {
  tenantId: string;
  fallbackOnboardingData?: JsonRecord | null | undefined;
}): Promise<BootstrapSnapshot> {
  const { data, error } = await supabase
    .from('tenants')
    .select('onboarding_data, updated_at')
    .eq('id', params.tenantId)
    .single();

  if (error || !data?.updated_at) {
    throw new Error(`Failed to load bootstrap state: ${error?.message ?? 'Tenant not found'}`);
  }

  const onboardingData = (data.onboarding_data as JsonRecord | null | undefined) ?? params.fallbackOnboardingData ?? {};
  return buildSnapshot(onboardingData, data.updated_at);
}

async function updateBootstrapSnapshotIfUnchanged(params: {
  tenantId: string;
  expectedUpdatedAt: string;
  onboardingData: JsonRecord;
}): Promise<BootstrapSnapshot | null> {
  const { data, error } = await supabase
    .from('tenants')
    .update({ onboarding_data: params.onboardingData })
    .eq('id', params.tenantId)
    .eq('updated_at', params.expectedUpdatedAt)
    .select('onboarding_data, updated_at')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to persist bootstrap state: ${error.message}`);
  }

  if (!data?.updated_at) {
    return null;
  }

  return buildSnapshot(data.onboarding_data as JsonRecord | null | undefined, data.updated_at);
}

function shouldPreserveCurrentState(current: BootstrapStatus, next: BootstrapStateUpdate['status']): boolean {
  if (current === 'completed' && next !== 'completed') {
    return true;
  }

  if ((current === 'dispatching' || current === 'accepted') && next === 'dispatching') {
    return true;
  }

  return false;
}

export async function transitionBootstrapState(params: {
  tenantId: string;
  update: BootstrapStateUpdate;
  allowedCurrentStatuses?: BootstrapStatus[];
  fallbackOnboardingData?: JsonRecord | null | undefined;
  maxAttempts?: number;
  preserveCurrentState?: boolean;
}): Promise<{ snapshot: BootstrapSnapshot; changed: boolean }> {
  const maxAttempts = params.maxAttempts ?? 3;
  const preserveCurrentState = params.preserveCurrentState ?? true;
  let snapshot = await loadBootstrapSnapshot({
    tenantId: params.tenantId,
    fallbackOnboardingData: params.fallbackOnboardingData,
  });

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (params.allowedCurrentStatuses && !params.allowedCurrentStatuses.includes(snapshot.state.status)) {
      return { snapshot, changed: false };
    }

    if (preserveCurrentState && shouldPreserveCurrentState(snapshot.state.status, params.update.status)) {
      return { snapshot, changed: false };
    }

    const nextOnboardingData = buildOnboardingDataWithBootstrapState(snapshot.onboardingData, params.update);
    const nextSnapshot = await updateBootstrapSnapshotIfUnchanged({
      tenantId: params.tenantId,
      expectedUpdatedAt: snapshot.updatedAt,
      onboardingData: nextOnboardingData,
    });

    if (nextSnapshot) {
      return { snapshot: nextSnapshot, changed: true };
    }

    snapshot = await loadBootstrapSnapshot({ tenantId: params.tenantId });
  }

  return { snapshot, changed: false };
}

export async function persistBootstrapState(params: {
  tenantId: string;
  onboardingData: JsonRecord | null | undefined;
  update: BootstrapStateUpdate;
}): Promise<JsonRecord> {
  const { snapshot } = await transitionBootstrapState({
    tenantId: params.tenantId,
    fallbackOnboardingData: params.onboardingData,
    update: params.update,
  });

  return snapshot.onboardingData;
}

export async function markBootstrapCompletedIfInProgress(params: {
  tenantId: string;
}): Promise<void> {
  await transitionBootstrapState({
    tenantId: params.tenantId,
    allowedCurrentStatuses: ['dispatching', 'accepted'],
    update: {
      status: 'completed',
    },
  });
}
