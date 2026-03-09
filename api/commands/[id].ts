import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { getCommandById, listCommandEvents, listWorkspaceEventsForCommand } from '../lib/commands';
import { getVaultRefreshStaleMetadataForCommand } from '../lib/vault-refresh-recovery';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const commandId = typeof req.query.id === 'string' ? req.query.id : null;

    if (!commandId) {
      return res.status(400).json({ error: 'Missing command id' });
    }

    const command = await getCommandById(tenant.id, commandId);
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }

    const [events, workspaceEvents] = await Promise.all([
      listCommandEvents(command.id),
      listWorkspaceEventsForCommand(command.id),
    ]);
    const stale = await getVaultRefreshStaleMetadataForCommand({
      tenantId: tenant.id,
      command,
    });

    return res.status(200).json({
      command,
      events,
      workspace_events: workspaceEvents,
      stale,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
