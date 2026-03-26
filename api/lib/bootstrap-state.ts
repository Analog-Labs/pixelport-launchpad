import { supabase } from './supabase';
import { VAULT_SECTION_KEYS } from './vault-contract';

type JsonRecord = Record<string, unknown>;

const BOOTSTRAP_STATUSES = ['not_started', 'dispatching', 'accepted', 'completed', 'failed'] as const;
const BOOTSTRAP_SOURCES = ['provisioning', 'dashboard_replay', 'manual_force', 'manual_bootstrap'] as const;

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

export type BootstrapDurableProgress = {
  taskCount: number;
  competitorCount: number;
  totalVaultSectionCount: number;
  readyVaultSectionCount: number;
  agentUpdatedVaultCount: number;
  kickoffIssueSeeded: boolean;
  kickoffApprovalSeeded: boolean;
  workspaceContractSeeded: boolean;
  latestAgentActivityAt: string | null;
  hasAgentOutput: boolean;
  durableComplete: boolean;
};

export type BootstrapDerivedState = {
  status: BootstrapStatus;
  last_error: string | null;
};

export const BOOTSTRAP_DISPATCH_TIMEOUT_MS = 10 * 60 * 1000;
export const BOOTSTRAP_ACCEPTED_TIMEOUT_MS = 15 * 60 * 1000;

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
    nextBootstrap.accepted_at = currentState.accepted_at ?? now;
    nextBootstrap.completed_at = null;
    nextBootstrap.last_error = null;
  } else if (update.status === 'completed') {
    nextBootstrap.requested_at = currentState.requested_at ?? now;
    nextBootstrap.accepted_at = currentState.accepted_at ?? now;
    nextBootstrap.completed_at = now;
    nextBootstrap.last_error = null;
  } else if (update.status === 'failed') {
    nextBootstrap.requested_at = currentState.requested_at ?? now;
    nextBootstrap.accepted_at = currentState.accepted_at;
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

function parseDateMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatBootstrapTimeoutMessage(kind: 'dispatching' | 'accepted'): string {
  return kind === 'dispatching'
    ? 'Bootstrap timed out before the Chief acknowledged the run.'
    : 'Bootstrap timed out before durable dashboard truth was written.';
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  let latestValue: string | null = null;
  let latestMs: number | null = null;

  for (const value of values) {
    const parsed = parseDateMs(value ?? null);
    if (parsed === null) {
      continue;
    }

    if (latestMs === null || parsed > latestMs) {
      latestMs = parsed;
      latestValue = value ?? null;
    }
  }

  return latestValue;
}

function readBootstrapSeedSignals(onboardingData: JsonRecord | null | undefined): {
  kickoffIssueSeeded: boolean;
  kickoffApprovalSeeded: boolean;
  workspaceContractSeeded: boolean;
} {
  const root = cloneOnboardingData(onboardingData);
  const bootstrapSeed = isJsonRecord(root.bootstrap_seed) ? root.bootstrap_seed : {};
  const workspaceContract = isJsonRecord(bootstrapSeed.workspace_contract)
    ? bootstrapSeed.workspace_contract
    : {};

  const kickoffIssueSeeded =
    typeof bootstrapSeed.kickoff_issue_id === 'string' && bootstrapSeed.kickoff_issue_id.trim().length > 0;
  const kickoffApprovalSeeded =
    typeof bootstrapSeed.kickoff_approval_id === 'string' && bootstrapSeed.kickoff_approval_id.trim().length > 0;
  const workspaceContractSeeded =
    typeof workspaceContract.version === 'string' && workspaceContract.version.trim().length > 0;

  return {
    kickoffIssueSeeded,
    kickoffApprovalSeeded,
    workspaceContractSeeded,
  };
}

async function countRows(
  table: 'agent_tasks' | 'competitors' | 'vault_sections',
  tenantId: string,
  extra?: { column: string; value: string }
): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);

  if (extra) {
    query = query.eq(extra.column, extra.value);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to inspect ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function getLatestUpdatedAt(
  table: 'agent_tasks' | 'competitors' | 'vault_sections',
  tenantId: string,
  extra?: { column: string; value: string }
): Promise<string | null> {
  let query = supabase
    .from(table)
    .select('updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (extra) {
    query = query.eq(extra.column, extra.value);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to inspect latest ${table} activity: ${error.message}`);
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  if (!firstRow || typeof firstRow.updated_at !== 'string') {
    return null;
  }

  return firstRow.updated_at;
}

export async function inspectBootstrapDurableProgress(params: {
  tenantId: string;
  onboardingData?: JsonRecord | null | undefined;
}): Promise<BootstrapDurableProgress> {
  const seedSignals = readBootstrapSeedSignals(params.onboardingData);
  const [taskCount, competitorCount, totalVaultSectionCount, readyVaultSectionCount, agentUpdatedVaultCount, latestTaskAt, latestCompetitorAt, latestVaultAt] =
    await Promise.all([
      countRows('agent_tasks', params.tenantId),
      countRows('competitors', params.tenantId),
      countRows('vault_sections', params.tenantId),
      countRows('vault_sections', params.tenantId, { column: 'status', value: 'ready' }),
      countRows('vault_sections', params.tenantId, { column: 'last_updated_by', value: 'agent' }),
      getLatestUpdatedAt('agent_tasks', params.tenantId),
      getLatestUpdatedAt('competitors', params.tenantId),
      getLatestUpdatedAt('vault_sections', params.tenantId, { column: 'last_updated_by', value: 'agent' }),
    ]);

  const latestAgentActivityAt = latestTimestamp([latestTaskAt, latestCompetitorAt, latestVaultAt]);
  const hasAgentOutput =
    taskCount > 0 ||
    competitorCount > 0 ||
    agentUpdatedVaultCount > 0 ||
    readyVaultSectionCount > 0 ||
    seedSignals.kickoffIssueSeeded ||
    seedSignals.kickoffApprovalSeeded;
  const hasDurableBootstrapSeed =
    seedSignals.kickoffIssueSeeded && seedSignals.kickoffApprovalSeeded && seedSignals.workspaceContractSeeded;
  const durableComplete =
    totalVaultSectionCount >= VAULT_SECTION_KEYS.length &&
    hasAgentOutput &&
    (readyVaultSectionCount > 0 || hasDurableBootstrapSeed);

  return {
    taskCount,
    competitorCount,
    totalVaultSectionCount,
    readyVaultSectionCount,
    agentUpdatedVaultCount,
    kickoffIssueSeeded: seedSignals.kickoffIssueSeeded,
    kickoffApprovalSeeded: seedSignals.kickoffApprovalSeeded,
    workspaceContractSeeded: seedSignals.workspaceContractSeeded,
    latestAgentActivityAt,
    hasAgentOutput,
    durableComplete,
  };
}

export function deriveBootstrapState(params: {
  state: BootstrapState;
  progress: BootstrapDurableProgress;
  now?: string;
}): BootstrapDerivedState {
  const nowMs = parseDateMs(params.now ?? new Date().toISOString()) ?? Date.now();

  if (params.progress.durableComplete) {
    return {
      status: 'completed',
      last_error: null,
    };
  }

  if (params.state.status === 'failed') {
    return {
      status: 'failed',
      last_error: params.state.last_error ?? formatBootstrapTimeoutMessage('accepted'),
    };
  }

  if (params.state.status === 'not_started') {
    return {
      status: 'not_started',
      last_error: null,
    };
  }

  if (params.state.status === 'dispatching') {
    const requestedAtMs = parseDateMs(params.state.requested_at);
    const timedOut = requestedAtMs !== null && nowMs - requestedAtMs > BOOTSTRAP_DISPATCH_TIMEOUT_MS;

    return timedOut
      ? {
          status: 'failed',
          last_error: formatBootstrapTimeoutMessage('dispatching'),
        }
      : {
          status: 'dispatching',
          last_error: null,
        };
  }

  const activeReferenceAt = latestTimestamp([
    params.progress.latestAgentActivityAt,
    params.state.accepted_at,
    params.state.requested_at,
  ]);
  const activeReferenceMs = parseDateMs(activeReferenceAt);
  const timedOut = activeReferenceMs !== null && nowMs - activeReferenceMs > BOOTSTRAP_ACCEPTED_TIMEOUT_MS;

  return timedOut
    ? {
        status: 'failed',
        last_error: formatBootstrapTimeoutMessage('accepted'),
      }
    : {
        status: 'accepted',
        last_error: null,
      };
}

export async function reconcileBootstrapState(params: {
  tenantId: string;
  fallbackOnboardingData?: JsonRecord | null | undefined;
  now?: string;
  persistFailure?: boolean;
}): Promise<{
  snapshot: BootstrapSnapshot;
  progress: BootstrapDurableProgress;
  effectiveState: BootstrapDerivedState;
  changed: boolean;
}> {
  let snapshot = await loadBootstrapSnapshot({
    tenantId: params.tenantId,
    fallbackOnboardingData: params.fallbackOnboardingData,
  });
  const progress = await inspectBootstrapDurableProgress({
    tenantId: params.tenantId,
    onboardingData: snapshot.onboardingData,
  });
  const effectiveState = deriveBootstrapState({
    state: snapshot.state,
    progress,
    now: params.now,
  });
  const persistFailure = params.persistFailure ?? true;
  const shouldPersistFailure =
    effectiveState.status === 'failed' &&
    persistFailure &&
    snapshot.state.status !== 'failed';
  const shouldPersistAcceptedCorrection =
    effectiveState.status === 'accepted' && snapshot.state.status === 'completed';
  const shouldPersistCompletion = effectiveState.status === 'completed' && snapshot.state.status !== 'completed';
  const shouldPersistLastErrorChange =
    effectiveState.status === 'failed' &&
    effectiveState.last_error !== snapshot.state.last_error &&
    persistFailure;

  if (
    !shouldPersistFailure &&
    !shouldPersistAcceptedCorrection &&
    !shouldPersistCompletion &&
    !shouldPersistLastErrorChange
  ) {
    return {
      snapshot,
      progress,
      effectiveState,
      changed: false,
    };
  }

  const transition = await transitionBootstrapState({
    tenantId: params.tenantId,
    fallbackOnboardingData: snapshot.onboardingData,
    preserveCurrentState: false,
    update: {
      status: effectiveState.status === 'not_started' ? 'failed' : effectiveState.status,
      source: snapshot.state.source ?? 'provisioning',
      lastError: effectiveState.last_error,
      at: params.now,
    },
  });

  snapshot = transition.snapshot;

  return {
    snapshot,
    progress,
    effectiveState,
    changed: transition.changed,
  };
}

export async function syncBootstrapStateAfterAgentWrite(params: {
  tenantId: string;
  fallbackOnboardingData?: JsonRecord | null | undefined;
  now?: string;
}): Promise<void> {
  const snapshot = await loadBootstrapSnapshot({
    tenantId: params.tenantId,
    fallbackOnboardingData: params.fallbackOnboardingData,
  });

  if (snapshot.state.status === 'not_started') {
    return;
  }

  const progress = await inspectBootstrapDurableProgress({
    tenantId: params.tenantId,
    onboardingData: snapshot.onboardingData,
  });

  if (!progress.durableComplete) {
    return;
  }

  await transitionBootstrapState({
    tenantId: params.tenantId,
    fallbackOnboardingData: snapshot.onboardingData,
    preserveCurrentState: false,
    update: {
      status: 'completed',
      source: snapshot.state.source ?? 'provisioning',
      at: params.now,
    },
  });
}
