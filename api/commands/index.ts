import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveCommandInput } from '../lib/command-definitions';
import { buildCommandDispatchMessage } from '../lib/command-contract';
import {
  appendCommandEvent,
  createCommandRecord,
  getActiveCommandByType,
  getActiveCommandByTarget,
  getCommandByIdempotencyKey,
  listNonTerminalCommandsByType,
  listCommands,
  updateCommandStatus,
} from '../lib/commands';
import {
  annotateCommandsWithVaultRefreshStaleMetadata,
  recoverStaleVaultRefreshCommands,
} from '../lib/vault-refresh-recovery';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { dispatchAgentHookMessage } from '../lib/onboarding-bootstrap';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonRecord
  | JsonValue[];

type JsonRecord = Record<string, JsonValue>;

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asJsonRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const { tenant } = await authenticateRequest(req);
  const status = normalizeString(req.query.status);
  const commandType = normalizeString(req.query.command_type);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const { commands, total } = await listCommands({
    tenantId: tenant.id,
    status,
    commandType,
    limit,
    offset,
  });
  const commandsWithStale = await annotateCommandsWithVaultRefreshStaleMetadata({
    tenantId: tenant.id,
    commands,
  });

  return res.status(200).json({
    commands: commandsWithStale,
    total,
    limit,
    offset,
  });
}

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const { tenant, userId } = await authenticateRequest(req);

  const commandType = normalizeString(req.body?.command_type);
  const title = normalizeString(req.body?.title);
  const instructions = normalizeString(req.body?.instructions);
  const idempotencyKey = normalizeString(req.body?.idempotency_key);
  const targetEntityType = normalizeString(req.body?.target_entity_type);
  const targetEntityId = normalizeString(req.body?.target_entity_id);
  const payload = req.body?.payload === undefined ? {} : asJsonRecord(req.body?.payload);

  if (!commandType || !idempotencyKey) {
    return res.status(400).json({
      error: 'Missing required fields: command_type, idempotency_key',
    });
  }

  if (req.body?.payload !== undefined && !payload) {
    return res.status(400).json({ error: 'payload must be a JSON object when provided' });
  }

  const resolvedCommand = resolveCommandInput({
    commandType,
    title,
    instructions,
    targetEntityType,
    targetEntityId,
    payload: payload ?? {},
  });

  if (!resolvedCommand.ok) {
    return res.status(resolvedCommand.status).json({ error: resolvedCommand.error });
  }

  const commandInput = resolvedCommand.command;
  let recoveredStaleCommands: Awaited<
    ReturnType<typeof recoverStaleVaultRefreshCommands>
  >['recovered'] = [];

  const existing = await getCommandByIdempotencyKey(tenant.id, idempotencyKey);
  if (existing) {
    return res.status(200).json({
      idempotent: true,
      reuse_reason: 'idempotency_key',
      command: existing,
    });
  }

  if (commandInput.activeCommandReuseScope !== 'none') {
    let activeCommand = null;

    if (commandInput.commandType === 'vault_refresh') {
      const nonTerminalVaultRefreshCommands = await listNonTerminalCommandsByType({
        tenantId: tenant.id,
        commandType: commandInput.commandType,
      });
      const staleRecovery = await recoverStaleVaultRefreshCommands({
        tenantId: tenant.id,
        commands: nonTerminalVaultRefreshCommands,
      });
      recoveredStaleCommands = staleRecovery.recovered;
      activeCommand = staleRecovery.activeCommands[0] ?? null;
    } else {
      if (
        commandInput.activeCommandReuseScope === 'target' &&
        commandInput.targetEntityType &&
        commandInput.targetEntityId
      ) {
        activeCommand = await getActiveCommandByTarget({
          tenantId: tenant.id,
          commandType: commandInput.commandType,
          targetEntityType: commandInput.targetEntityType,
          targetEntityId: commandInput.targetEntityId,
        });
      }

      if (commandInput.activeCommandReuseScope === 'command_type') {
        activeCommand = await getActiveCommandByType({
          tenantId: tenant.id,
          commandType: commandInput.commandType,
        });
      }
    }

    if (activeCommand) {
      const isSameTarget =
        activeCommand.target_entity_type === commandInput.targetEntityType &&
        activeCommand.target_entity_id === commandInput.targetEntityId;

      return res.status(200).json({
        idempotent: false,
        reuse_reason: isSameTarget ? 'active_target' : 'active_command_type',
        command: activeCommand,
        ...(recoveredStaleCommands.length > 0
          ? { recovered_stale_commands: recoveredStaleCommands }
          : {}),
      });
    }
  }

  let command;
  try {
    command = await createCommandRecord({
      tenantId: tenant.id,
      requestedByUserId: userId,
      source: 'dashboard',
      commandType: commandInput.commandType,
      title: commandInput.title,
      instructions: commandInput.instructions,
      idempotencyKey,
      targetEntityType: commandInput.targetEntityType,
      targetEntityId: commandInput.targetEntityId,
      payload: commandInput.payload,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'COMMAND_IDEMPOTENCY_CONFLICT') {
      const conflict = await getCommandByIdempotencyKey(tenant.id, idempotencyKey);
      if (conflict) {
        return res.status(200).json({
          idempotent: true,
          reuse_reason: 'idempotency_key',
          command: conflict,
        });
      }
    }

    throw error;
  }

  await appendCommandEvent({
    tenantId: tenant.id,
    commandId: command.id,
    eventType: 'created',
    status: 'pending',
    actorType: 'dashboard',
    actorId: userId,
    message: `Structured command created: ${commandInput.title}`,
    payload: commandInput.payload,
  });

  if (!tenant.droplet_ip || !tenant.gateway_token) {
    const failedCommand = await updateCommandStatus({
      command,
      nextStatus: 'failed',
      lastError: 'Agent infrastructure not ready',
    });

    await appendCommandEvent({
      tenantId: tenant.id,
      commandId: command.id,
      eventType: 'dispatch_failed',
      status: 'failed',
      actorType: 'system',
      actorId: null,
      message: 'Command could not be dispatched because the tenant runtime is not ready.',
      payload: {
        reason: 'runtime_not_ready',
      },
    });

    return res.status(503).json({
      error: 'Agent infrastructure not ready',
      command: failedCommand,
    });
  }

  const dispatchResult = await dispatchAgentHookMessage({
    gatewayUrl: `http://${tenant.droplet_ip}:18789`,
    gatewayToken: tenant.gateway_token,
    name: `PixelPort Command: ${commandInput.title}`,
    message: buildCommandDispatchMessage({
      commandId: command.id,
      commandType: commandInput.commandType,
      title: commandInput.title,
      instructions: commandInput.instructions,
      targetEntityType: commandInput.targetEntityType,
      targetEntityId: commandInput.targetEntityId,
      payload: commandInput.payload,
      commandSpecificRequirements: commandInput.dispatchRequirements,
    }),
  });

  if (!dispatchResult.ok) {
    const failedCommand = await updateCommandStatus({
      command,
      nextStatus: 'failed',
      lastError: dispatchResult.body,
    });

    await appendCommandEvent({
      tenantId: tenant.id,
      commandId: command.id,
      eventType: 'dispatch_failed',
      status: 'failed',
      actorType: 'system',
      actorId: null,
      message: 'Runtime hook rejected the command dispatch.',
      payload: {
        gateway_status: dispatchResult.status,
        body: dispatchResult.body,
      },
    });

    return res.status(502).json({
      error: 'Runtime hook rejected the command dispatch',
      command: failedCommand,
      gateway_status: dispatchResult.status,
    });
  }

  const dispatchedCommand = await updateCommandStatus({
    command,
    nextStatus: 'dispatched',
  });

  await appendCommandEvent({
    tenantId: tenant.id,
    commandId: command.id,
    eventType: 'dispatched',
    status: 'dispatched',
    actorType: 'system',
    actorId: null,
    message: 'Command dispatched to the Chief through the runtime hook.',
    payload: {
      gateway_status: dispatchResult.status,
    },
  });

  return res.status(201).json({
    idempotent: false,
    command: dispatchedCommand,
    ...(recoveredStaleCommands.length > 0
      ? { recovered_stale_commands: recoveredStaleCommands }
      : {}),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method === 'GET') {
    try {
      return await handleGet(req, res);
    } catch (error) {
      return errorResponse(res, error);
    }
  }

  if (req.method === 'POST') {
    try {
      return await handlePost(req, res);
    } catch (error) {
      return errorResponse(res, error);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
