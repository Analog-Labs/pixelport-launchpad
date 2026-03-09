import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCommandStatusForRuntimeEvent } from '../lib/command-contract';
import {
  appendCommandEvent,
  getCommandById,
  insertWorkspaceEvent,
  maybeAdvanceCommandFromRuntimeEvent,
} from '../lib/commands';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);

    const eventId = normalizeString(req.body?.event_id);
    const eventType = normalizeString(req.body?.event_type);
    const entityType = normalizeString(req.body?.entity_type);
    const entityId = normalizeString(req.body?.entity_id);
    const commandId = normalizeString(req.body?.command_id);
    const agentId = normalizeString(req.body?.agent_id) || 'main';
    const occurredAt = normalizeString(req.body?.occurred_at) || undefined;
    const payload = req.body?.payload === undefined ? {} : asJsonRecord(req.body?.payload);

    if (!eventId || !eventType || !entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required fields: event_id, event_type, entity_type, entity_id',
      });
    }

    if (req.body?.payload !== undefined && !payload) {
      return res.status(400).json({ error: 'payload must be a JSON object when provided' });
    }

    const command = commandId ? await getCommandById(tenant.id, commandId) : null;
    if (commandId && !command) {
      return res.status(404).json({ error: 'Command not found for this tenant' });
    }

    const { event, duplicate } = await insertWorkspaceEvent({
      tenantId: tenant.id,
      commandId: command?.id ?? null,
      eventId,
      eventType,
      entityType,
      entityId,
      agentId,
      occurredAt,
      payload,
    });

    if (duplicate) {
      return res.status(200).json({
        duplicate: true,
        event,
      });
    }

    let updatedCommand = command;
    const mappedStatus = getCommandStatusForRuntimeEvent(eventType);

    if (command && mappedStatus) {
      updatedCommand = await maybeAdvanceCommandFromRuntimeEvent({
        command,
        eventType,
        occurredAt: event.occurred_at,
        payload,
      });

      await appendCommandEvent({
        tenantId: tenant.id,
        commandId: command.id,
        eventType,
        status: mappedStatus,
        actorType: 'runtime',
        actorId: agentId,
        message:
          normalizeString(payload?.summary) ||
          normalizeString(payload?.message) ||
          `Runtime emitted ${eventType}`,
        payload,
        occurredAt: event.occurred_at,
      });
    }

    return res.status(201).json({
      duplicate: false,
      event,
      command: updatedCommand,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
