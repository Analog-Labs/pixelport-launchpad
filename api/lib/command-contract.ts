type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonRecord
  | JsonValue[];

type JsonRecord = Record<string, JsonValue>;

export const COMMAND_STATUSES = [
  'pending',
  'dispatched',
  'acknowledged',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const COMMAND_RUNTIME_EVENT_TO_STATUS = {
  'command.acknowledged': 'acknowledged',
  'command.running': 'running',
  'command.completed': 'completed',
  'command.failed': 'failed',
  'command.cancelled': 'cancelled',
} as const satisfies Record<string, CommandStatus>;

export const COMMAND_TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;

export type CommandTerminalStatus = (typeof COMMAND_TERMINAL_STATUSES)[number];

export const COMMAND_STATUS_TIMESTAMP_FIELDS = {
  dispatched: 'dispatched_at',
  acknowledged: 'acknowledged_at',
  running: 'started_at',
  completed: 'completed_at',
  failed: 'failed_at',
  cancelled: 'cancelled_at',
} as const satisfies Partial<Record<CommandStatus, string>>;

const COMMAND_STATUS_ORDER: Record<CommandStatus, number> = {
  pending: 0,
  dispatched: 1,
  acknowledged: 2,
  running: 3,
  completed: 4,
  failed: 4,
  cancelled: 4,
};

export function isCommandStatus(value: unknown): value is CommandStatus {
  return typeof value === 'string' && COMMAND_STATUSES.includes(value as CommandStatus);
}

export function isTerminalCommandStatus(status: CommandStatus): status is CommandTerminalStatus {
  return COMMAND_TERMINAL_STATUSES.includes(status as CommandTerminalStatus);
}

export function getCommandStatusForRuntimeEvent(eventType: string): CommandStatus | null {
  return COMMAND_RUNTIME_EVENT_TO_STATUS[eventType as keyof typeof COMMAND_RUNTIME_EVENT_TO_STATUS] ?? null;
}

export function getCommandTimestampField(
  status: CommandStatus
): (typeof COMMAND_STATUS_TIMESTAMP_FIELDS)[keyof typeof COMMAND_STATUS_TIMESTAMP_FIELDS] | null {
  return COMMAND_STATUS_TIMESTAMP_FIELDS[status as keyof typeof COMMAND_STATUS_TIMESTAMP_FIELDS] ?? null;
}

export function shouldAdvanceCommandStatus(current: CommandStatus, next: CommandStatus): boolean {
  if (current === next) {
    return false;
  }

  if (isTerminalCommandStatus(current)) {
    return false;
  }

  return COMMAND_STATUS_ORDER[next] >= COMMAND_STATUS_ORDER[current];
}

function stringifyPayload(payload: JsonRecord | null | undefined): string {
  if (!payload || Object.keys(payload).length === 0) {
    return '{}';
  }

  return JSON.stringify(payload, null, 2);
}

export function buildCommandDispatchMessage(params: {
  commandId: string;
  commandType: string;
  title: string;
  instructions: string;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  payload?: JsonRecord | null;
}): string {
  const targetSummary = params.targetEntityType && params.targetEntityId
    ? `${params.targetEntityType}:${params.targetEntityId}`
    : 'none';

  return [
    'You have received a structured PixelPort command.',
    '',
    `Command ID: ${params.commandId}`,
    `Command type: ${params.commandType}`,
    `Title: ${params.title}`,
    `Target: ${targetSummary}`,
    '',
    'Instructions:',
    params.instructions.trim(),
    '',
    'Runtime contract:',
    '1. Emit `command.acknowledged` to `/api/agent/workspace-events` as soon as you accept this work.',
    '2. Emit `command.running` when execution begins.',
    '3. Write durable runtime artifacts under `pixelport/` and keep disposable sub-agent work under `pixelport/scratch/subagents/`.',
    '4. Emit `runtime.artifact.promoted` when you promote a final artifact into a canonical `pixelport/` location.',
    '5. Emit exactly one terminal event: `command.completed`, `command.failed`, or `command.cancelled`.',
    '',
    'Payload:',
    '```json',
    stringifyPayload(params.payload ?? undefined),
    '```',
  ].join('\n');
}
