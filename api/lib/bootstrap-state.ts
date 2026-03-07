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

export async function persistBootstrapState(params: {
  tenantId: string;
  onboardingData: JsonRecord | null | undefined;
  update: BootstrapStateUpdate;
}): Promise<JsonRecord> {
  const nextOnboardingData = buildOnboardingDataWithBootstrapState(params.onboardingData, params.update);

  const { data, error } = await supabase
    .from('tenants')
    .update({ onboarding_data: nextOnboardingData })
    .eq('id', params.tenantId)
    .select('onboarding_data')
    .single();

  if (error) {
    throw new Error(`Failed to persist bootstrap state: ${error.message}`);
  }

  return cloneOnboardingData((data?.onboarding_data as JsonRecord | null | undefined) ?? nextOnboardingData);
}

export async function markBootstrapCompletedIfInProgress(params: {
  tenantId: string;
  onboardingData: JsonRecord | null | undefined;
}): Promise<void> {
  const state = getBootstrapState(params.onboardingData);

  if (state.status !== 'dispatching' && state.status !== 'accepted') {
    return;
  }

  await persistBootstrapState({
    tenantId: params.tenantId,
    onboardingData: params.onboardingData,
    update: {
      status: 'completed',
      source: state.source ?? 'provisioning',
    },
  });
}
