import { NON_TERMINAL_COMMAND_STATUSES, type CommandStatus } from './command-contract';
import {
  appendCommandEvent,
  markCommandFailedIfStillNonTerminal,
  type CommandRecordRow,
} from './commands';
import { supabase } from './supabase';

const READY_AFTER_ACTIVITY_THRESHOLD_MS = 60_000;
const ACK_TIMEOUT_MS = 10 * 60_000;
const RUNTIME_INACTIVITY_TIMEOUT_MS = 15 * 60_000;

type VaultSectionStatus = 'pending' | 'populating' | 'ready' | null;

type VaultSectionRow = {
  section_key: string;
  status: VaultSectionStatus;
  updated_at: string | null;
};

export type VaultRefreshStaleReason =
  | 'target_ready_after_activity'
  | 'awaiting_runtime_ack'
  | 'runtime_activity_timeout';

export type VaultRefreshStaleMetadata = {
  is_stale: true;
  reason: VaultRefreshStaleReason;
  summary: string;
  detected_at: string;
  latest_activity_at: string;
  target_section_status: VaultSectionStatus;
  target_section_updated_at: string | null;
};

export type CommandRecordWithStaleMetadata = CommandRecordRow & {
  stale: VaultRefreshStaleMetadata | null;
};

export type RecoveredStaleVaultRefreshCommand = {
  id: string;
  reason: VaultRefreshStaleReason;
  previous_status: CommandStatus;
  summary: string;
  detected_at: string;
  latest_activity_at: string;
};

type VaultRefreshStaleClassificationInput = {
  command: CommandRecordRow;
  now: string;
  latestWorkspaceEventAt: string | null;
  targetSectionStatus: VaultSectionStatus;
  targetSectionUpdatedAt: string | null;
};

function toMillis(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function maxDate(values: Array<string | null | undefined>): string | null {
  let winner: string | null = null;
  let winnerMillis: number | null = null;

  for (const value of values) {
    const millis = toMillis(value);
    if (millis === null) {
      continue;
    }

    if (winnerMillis === null || millis > winnerMillis) {
      winner = value ?? null;
      winnerMillis = millis;
    }
  }

  return winner;
}

function buildStaleSummary(params: {
  reason: VaultRefreshStaleReason;
  status: CommandStatus;
  targetSectionStatus: VaultSectionStatus;
}): string {
  switch (params.reason) {
    case 'target_ready_after_activity':
      return `Vault refresh stalled: the ${params.targetSectionStatus ?? 'target'} section is already ready with newer vault truth, but this command never reached a terminal state.`;
    case 'awaiting_runtime_ack':
      return `Vault refresh stalled: Chief never acknowledged this ${params.status} refresh after dispatch.`;
    case 'runtime_activity_timeout':
      return `Vault refresh stalled: Chief stopped reporting progress after the refresh entered ${params.status}.`;
    default:
      return 'Vault refresh stalled and was automatically recovered.';
  }
}

export function getCommandLatestActivityAt(params: {
  command: CommandRecordRow;
  latestWorkspaceEventAt?: string | null;
}): string {
  return (
    maxDate([
      params.command.created_at,
      params.command.dispatched_at,
      params.command.acknowledged_at,
      params.command.started_at,
      params.command.completed_at,
      params.command.failed_at,
      params.command.cancelled_at,
      params.command.updated_at,
      params.latestWorkspaceEventAt ?? null,
    ]) ?? params.command.created_at ?? new Date(0).toISOString()
  );
}

export function classifyVaultRefreshStaleCommand(
  params: VaultRefreshStaleClassificationInput
): VaultRefreshStaleMetadata | null {
  if (
    params.command.command_type !== 'vault_refresh' ||
    !NON_TERMINAL_COMMAND_STATUSES.includes(params.command.status)
  ) {
    return null;
  }

  const latestActivityAt = getCommandLatestActivityAt({
    command: params.command,
    latestWorkspaceEventAt: params.latestWorkspaceEventAt,
  });
  const latestActivityMillis = toMillis(latestActivityAt);
  const nowMillis = toMillis(params.now);
  const targetSectionUpdatedMillis = toMillis(params.targetSectionUpdatedAt);

  if (latestActivityMillis === null || nowMillis === null) {
    return null;
  }

  let reason: VaultRefreshStaleReason | null = null;

  if (
    params.targetSectionStatus === 'ready' &&
    targetSectionUpdatedMillis !== null &&
    targetSectionUpdatedMillis - latestActivityMillis >= READY_AFTER_ACTIVITY_THRESHOLD_MS
  ) {
    reason = 'target_ready_after_activity';
  } else if (
    (params.command.status === 'pending' || params.command.status === 'dispatched') &&
    !params.command.acknowledged_at &&
    nowMillis - latestActivityMillis >= ACK_TIMEOUT_MS
  ) {
    reason = 'awaiting_runtime_ack';
  } else if (
    (params.command.status === 'acknowledged' || params.command.status === 'running') &&
    nowMillis - latestActivityMillis >= RUNTIME_INACTIVITY_TIMEOUT_MS
  ) {
    reason = 'runtime_activity_timeout';
  }

  if (!reason) {
    return null;
  }

  return {
    is_stale: true,
    reason,
    summary: buildStaleSummary({
      reason,
      status: params.command.status,
      targetSectionStatus: params.targetSectionStatus,
    }),
    detected_at: params.now,
    latest_activity_at: latestActivityAt,
    target_section_status: params.targetSectionStatus,
    target_section_updated_at: params.targetSectionUpdatedAt,
  };
}

async function listLatestWorkspaceEventTimes(commandIds: string[]): Promise<Map<string, string>> {
  if (commandIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('workspace_events')
    .select('command_id, occurred_at')
    .in('command_id', commandIds)
    .order('occurred_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load workspace events for stale classification: ${error.message}`);
  }

  const latestByCommandId = new Map<string, string>();
  for (const event of (data as Array<{ command_id: string | null; occurred_at: string }> | null) ?? []) {
    if (!event.command_id || latestByCommandId.has(event.command_id)) {
      continue;
    }

    latestByCommandId.set(event.command_id, event.occurred_at);
  }

  return latestByCommandId;
}

async function listTargetVaultSections(
  tenantId: string,
  sectionKeys: string[]
): Promise<Map<string, VaultSectionRow>> {
  if (sectionKeys.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('vault_sections')
    .select('section_key, status, updated_at')
    .eq('tenant_id', tenantId)
    .in('section_key', sectionKeys);

  if (error) {
    throw new Error(`Failed to load vault sections for stale classification: ${error.message}`);
  }

  return new Map(
    ((data as VaultSectionRow[] | null) ?? []).map((section) => [section.section_key, section])
  );
}

export async function annotateCommandsWithVaultRefreshStaleMetadata(params: {
  tenantId: string;
  commands: CommandRecordRow[];
  now?: string;
}): Promise<CommandRecordWithStaleMetadata[]> {
  const now = params.now ?? new Date().toISOString();
  const vaultRefreshCommands = params.commands.filter(
    (command) =>
      command.command_type === 'vault_refresh' &&
      NON_TERMINAL_COMMAND_STATUSES.includes(command.status) &&
      command.target_entity_type === 'vault_section' &&
      typeof command.target_entity_id === 'string'
  );

  const [latestWorkspaceEvents, targetSections] = await Promise.all([
    listLatestWorkspaceEventTimes(vaultRefreshCommands.map((command) => command.id)),
    listTargetVaultSections(
      params.tenantId,
      [...new Set(vaultRefreshCommands.map((command) => command.target_entity_id!).filter(Boolean))]
    ),
  ]);

  const staleByCommandId = new Map<string, VaultRefreshStaleMetadata | null>();
  for (const command of vaultRefreshCommands) {
    const targetSection = command.target_entity_id
      ? targetSections.get(command.target_entity_id)
      : undefined;

    staleByCommandId.set(
      command.id,
      classifyVaultRefreshStaleCommand({
        command,
        now,
        latestWorkspaceEventAt: latestWorkspaceEvents.get(command.id) ?? null,
        targetSectionStatus: targetSection?.status ?? null,
        targetSectionUpdatedAt: targetSection?.updated_at ?? null,
      })
    );
  }

  return params.commands.map((command) => ({
    ...command,
    stale: staleByCommandId.get(command.id) ?? null,
  }));
}

export async function getVaultRefreshStaleMetadataForCommand(params: {
  tenantId: string;
  command: CommandRecordRow;
  now?: string;
}): Promise<VaultRefreshStaleMetadata | null> {
  const [annotated] = await annotateCommandsWithVaultRefreshStaleMetadata({
    tenantId: params.tenantId,
    commands: [params.command],
    now: params.now,
  });

  return annotated?.stale ?? null;
}

export async function recoverStaleVaultRefreshCommands(params: {
  tenantId: string;
  commands: CommandRecordRow[];
  now?: string;
}): Promise<{
  annotatedCommands: CommandRecordWithStaleMetadata[];
  activeCommands: CommandRecordRow[];
  recovered: RecoveredStaleVaultRefreshCommand[];
}> {
  const now = params.now ?? new Date().toISOString();
  const annotatedCommands = await annotateCommandsWithVaultRefreshStaleMetadata({
    tenantId: params.tenantId,
    commands: params.commands,
    now,
  });

  const recovered: RecoveredStaleVaultRefreshCommand[] = [];

  for (const command of annotatedCommands) {
    if (!command.stale) {
      continue;
    }

    const repairedCommand = await markCommandFailedIfStillNonTerminal({
      tenantId: params.tenantId,
      commandId: command.id,
      lastError: command.stale.summary,
      occurredAt: command.stale.detected_at,
    });

    if (!repairedCommand) {
      continue;
    }

    await appendCommandEvent({
      tenantId: params.tenantId,
      commandId: command.id,
      eventType: 'stale_recovered',
      status: 'failed',
      actorType: 'system',
      actorId: null,
      message: command.stale.summary,
      payload: {
        reason: command.stale.reason,
        detected_at: command.stale.detected_at,
        latest_activity_at: command.stale.latest_activity_at,
        target_section_status: command.stale.target_section_status,
        target_section_updated_at: command.stale.target_section_updated_at,
        previous_status: command.status,
      },
      occurredAt: command.stale.detected_at,
    });

    recovered.push({
      id: command.id,
      reason: command.stale.reason,
      previous_status: command.status,
      summary: command.stale.summary,
      detected_at: command.stale.detected_at,
      latest_activity_at: command.stale.latest_activity_at,
    });
  }

  return {
    annotatedCommands,
    activeCommands: annotatedCommands.filter((command) => !command.stale),
    recovered,
  };
}
