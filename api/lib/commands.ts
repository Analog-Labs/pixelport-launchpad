import {
  type CommandStatus,
  getCommandStatusForRuntimeEvent,
  getCommandTimestampField,
  shouldAdvanceCommandStatus,
} from './command-contract';
import { supabase } from './supabase';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonRecord
  | JsonValue[];

type JsonRecord = Record<string, JsonValue>;

export type CommandRecordRow = {
  id: string;
  tenant_id: string;
  requested_by_user_id: string | null;
  source: string;
  command_type: string;
  title: string;
  instructions: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  payload: JsonRecord | null;
  idempotency_key: string;
  status: CommandStatus;
  last_error: string | null;
  dispatched_at: string | null;
  acknowledged_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CommandEventRow = {
  id: string;
  tenant_id: string;
  command_id: string;
  event_type: string;
  status: CommandStatus | null;
  actor_type: string;
  actor_id: string | null;
  message: string | null;
  payload: JsonRecord | null;
  occurred_at: string;
  created_at: string | null;
};

export type WorkspaceEventRow = {
  id: string;
  tenant_id: string;
  command_id: string | null;
  event_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  agent_id: string | null;
  occurred_at: string;
  payload: JsonRecord | null;
  created_at: string | null;
};

function assertSingleResult<T>(data: T | null, error: { message: string } | null, message: string): T {
  if (error || !data) {
    throw new Error(`${message}: ${error?.message ?? 'Missing row'}`);
  }

  return data;
}

export async function getCommandById(tenantId: string, commandId: string): Promise<CommandRecordRow | null> {
  const { data, error } = await supabase
    .from('command_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', commandId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load command record: ${error.message}`);
  }

  return (data as CommandRecordRow | null) ?? null;
}

export async function getCommandByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string
): Promise<CommandRecordRow | null> {
  const { data, error } = await supabase
    .from('command_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load command by idempotency key: ${error.message}`);
  }

  return (data as CommandRecordRow | null) ?? null;
}

export async function createCommandRecord(params: {
  tenantId: string;
  requestedByUserId: string;
  source: string;
  commandType: string;
  title: string;
  instructions: string;
  idempotencyKey: string;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  payload?: JsonRecord | null;
}): Promise<CommandRecordRow> {
  const { data, error } = await supabase
    .from('command_records')
    .insert({
      tenant_id: params.tenantId,
      requested_by_user_id: params.requestedByUserId,
      source: params.source,
      command_type: params.commandType,
      title: params.title,
      instructions: params.instructions,
      idempotency_key: params.idempotencyKey,
      target_entity_type: params.targetEntityType ?? null,
      target_entity_id: params.targetEntityId ?? null,
      payload: params.payload ?? {},
      status: 'pending',
    })
    .select('*')
    .single();

  if (error?.code === '23505') {
    throw new Error('COMMAND_IDEMPOTENCY_CONFLICT');
  }

  return assertSingleResult(
    data as CommandRecordRow | null,
    error,
    'Failed to create command record'
  );
}

export async function listCommands(params: {
  tenantId: string;
  status?: string | null;
  limit: number;
  offset: number;
}): Promise<{ commands: CommandRecordRow[]; total: number }> {
  let query = supabase
    .from('command_records')
    .select('*', { count: 'exact' })
    .eq('tenant_id', params.tenantId)
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list commands: ${error.message}`);
  }

  return {
    commands: (data as CommandRecordRow[] | null) ?? [],
    total: count ?? 0,
  };
}

export async function appendCommandEvent(params: {
  tenantId: string;
  commandId: string;
  eventType: string;
  status?: CommandStatus | null;
  actorType: string;
  actorId?: string | null;
  message?: string | null;
  payload?: JsonRecord | null;
  occurredAt?: string;
}): Promise<CommandEventRow> {
  const { data, error } = await supabase
    .from('command_events')
    .insert({
      tenant_id: params.tenantId,
      command_id: params.commandId,
      event_type: params.eventType,
      status: params.status ?? null,
      actor_type: params.actorType,
      actor_id: params.actorId ?? null,
      message: params.message ?? null,
      payload: params.payload ?? {},
      occurred_at: params.occurredAt ?? new Date().toISOString(),
    })
    .select('*')
    .single();

  return assertSingleResult(
    data as CommandEventRow | null,
    error,
    'Failed to append command event'
  );
}

export async function updateCommandStatus(params: {
  command: CommandRecordRow;
  nextStatus: CommandStatus;
  occurredAt?: string;
  lastError?: string | null;
}): Promise<CommandRecordRow> {
  if (!shouldAdvanceCommandStatus(params.command.status, params.nextStatus)) {
    return params.command;
  }

  const timestampField = getCommandTimestampField(params.nextStatus);
  const updateData: Record<string, unknown> = {
    status: params.nextStatus,
  };

  if (timestampField) {
    updateData[timestampField] = params.occurredAt ?? new Date().toISOString();
  }

  if (params.nextStatus === 'failed') {
    updateData.last_error = params.lastError ?? params.command.last_error;
  } else if (params.command.last_error) {
    updateData.last_error = null;
  }

  const { data, error } = await supabase
    .from('command_records')
    .update(updateData)
    .eq('tenant_id', params.command.tenant_id)
    .eq('id', params.command.id)
    .select('*')
    .single();

  return assertSingleResult(
    data as CommandRecordRow | null,
    error,
    'Failed to update command status'
  );
}

export async function listCommandEvents(commandId: string): Promise<CommandEventRow[]> {
  const { data, error } = await supabase
    .from('command_events')
    .select('*')
    .eq('command_id', commandId)
    .order('occurred_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load command events: ${error.message}`);
  }

  return (data as CommandEventRow[] | null) ?? [];
}

export async function listWorkspaceEventsForCommand(commandId: string): Promise<WorkspaceEventRow[]> {
  const { data, error } = await supabase
    .from('workspace_events')
    .select('*')
    .eq('command_id', commandId)
    .order('occurred_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load workspace events: ${error.message}`);
  }

  return (data as WorkspaceEventRow[] | null) ?? [];
}

export async function insertWorkspaceEvent(params: {
  tenantId: string;
  commandId?: string | null;
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  agentId?: string | null;
  occurredAt?: string;
  payload?: JsonRecord | null;
}): Promise<{ event: WorkspaceEventRow; duplicate: boolean }> {
  const insertPayload = {
    tenant_id: params.tenantId,
    command_id: params.commandId ?? null,
    event_id: params.eventId,
    event_type: params.eventType,
    entity_type: params.entityType,
    entity_id: params.entityId,
    agent_id: params.agentId ?? 'main',
    occurred_at: params.occurredAt ?? new Date().toISOString(),
    payload: params.payload ?? {},
  };

  const { data, error } = await supabase
    .from('workspace_events')
    .insert(insertPayload)
    .select('*')
    .single();

  if (!error && data) {
    return {
      event: data as WorkspaceEventRow,
      duplicate: false,
    };
  }

  if (error?.code === '23505') {
    const { data: existingEvent, error: existingError } = await supabase
      .from('workspace_events')
      .select('*')
      .eq('tenant_id', params.tenantId)
      .eq('event_id', params.eventId)
      .maybeSingle();

    return {
      event: assertSingleResult(
        existingEvent as WorkspaceEventRow | null,
        existingError,
        'Failed to load duplicate workspace event'
      ),
      duplicate: true,
    };
  }

  throw new Error(`Failed to insert workspace event: ${error?.message ?? 'Unknown error'}`);
}

export async function maybeAdvanceCommandFromRuntimeEvent(params: {
  command: CommandRecordRow;
  eventType: string;
  occurredAt?: string;
  payload?: JsonRecord | null;
}): Promise<CommandRecordRow> {
  const nextStatus = getCommandStatusForRuntimeEvent(params.eventType);
  if (!nextStatus) {
    return params.command;
  }

  const lastError = nextStatus === 'failed'
    ? typeof params.payload?.error === 'string'
      ? params.payload.error
      : typeof params.payload?.message === 'string'
        ? params.payload.message
        : null
    : null;

  return updateCommandStatus({
    command: params.command,
    nextStatus,
    occurredAt: params.occurredAt,
    lastError,
  });
}
