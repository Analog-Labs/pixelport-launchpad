import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';
import { resolveTenantMemorySettings } from '../lib/tenant-memory-settings';

const MEM0_API_BASE = 'https://api.mem0.ai/v1';

function buildMem0DisabledGetPayload(searchQuery?: string) {
  if (searchQuery) {
    return {
      enabled: false,
      provider: 'mem0',
      status: 'disabled',
      query: searchQuery,
      results: [],
    };
  }

  return {
    enabled: false,
    provider: 'mem0',
    status: 'disabled',
    memories: [],
  };
}

function buildMem0UnavailableGetPayload(searchQuery?: string, upstreamStatus?: number) {
  if (searchQuery) {
    return {
      error: 'Mem0 is currently unavailable',
      code: 'mem0_unavailable',
      enabled: true,
      provider: 'mem0',
      query: searchQuery,
      results: [],
      ...(upstreamStatus ? { upstream_status: upstreamStatus } : {}),
    };
  }

  return {
    error: 'Mem0 is currently unavailable',
    code: 'mem0_unavailable',
    enabled: true,
    provider: 'mem0',
    memories: [],
    ...(upstreamStatus ? { upstream_status: upstreamStatus } : {}),
  };
}

/**
 * /api/agent/memory — Mem0 per-tenant memory operations
 * Auth: X-Agent-Key header (per-tenant agent API key)
 *
 * GET  /api/agent/memory              — List all memories for tenant
 * GET  /api/agent/memory?q=<query>    — Search memories
 * POST /api/agent/memory              — Add a memory
 * DELETE /api/agent/memory?id=<memId> — Delete a specific memory
 *
 * Mem0 user_id is mapped to tenant.id for per-tenant isolation.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  try {
    const { tenant } = await authenticateAgentRequest(req);
    const mem0ApiKey = process.env.MEM0_API_KEY;
    const tenantMemorySettings = resolveTenantMemorySettings(tenant.settings);
    const tenantMemoryId = `pixelport-${tenant.id}`;
    const rawSearchQuery = req.query?.q;
    const searchQuery = Array.isArray(rawSearchQuery) ? rawSearchQuery[0] : rawSearchQuery;

    if (!tenantMemorySettings.mem0Enabled) {
      if (req.method === 'GET') {
        return res.status(200).json(buildMem0DisabledGetPayload(searchQuery));
      }

      return res.status(409).json({
        error: 'Mem0 is disabled for this tenant',
        code: 'mem0_disabled',
        enabled: false,
        provider: 'mem0',
      });
    }

    if (!mem0ApiKey) {
      if (req.method === 'GET') {
        return res.status(503).json(buildMem0UnavailableGetPayload(searchQuery));
      }

      return res.status(503).json({
        error: 'Mem0 is currently unavailable',
        code: 'mem0_unavailable',
        enabled: true,
        provider: 'mem0',
      });
    }

    const mem0Headers = {
      'Authorization': `Token ${mem0ApiKey}`,
      'Content-Type': 'application/json',
    };

    switch (req.method) {
      case 'GET': {
        if (searchQuery) {
          let searchResponse: Response;
          try {
            searchResponse = await fetch(`${MEM0_API_BASE}/memories/search/`, {
              method: 'POST',
              headers: mem0Headers,
              body: JSON.stringify({
                query: searchQuery,
                user_id: tenantMemoryId,
              }),
            });
          } catch (error) {
            console.error('Mem0 search failed:', error);
            return res.status(503).json(buildMem0UnavailableGetPayload(searchQuery));
          }

          if (!searchResponse.ok) {
            const errBody = await searchResponse.text();
            console.error('Mem0 search failed:', errBody);
            return res
              .status(503)
              .json(buildMem0UnavailableGetPayload(searchQuery, searchResponse.status));
          }

          const results = await searchResponse.json();
          return res.status(200).json(results);
        } else {
          let listResponse: Response;
          try {
            listResponse = await fetch(
              `${MEM0_API_BASE}/memories/?user_id=${encodeURIComponent(tenantMemoryId)}`,
              {
                method: 'GET',
                headers: mem0Headers,
              },
            );
          } catch (error) {
            console.error('Mem0 list failed:', error);
            return res.status(503).json(buildMem0UnavailableGetPayload());
          }

          if (!listResponse.ok) {
            const errBody = await listResponse.text();
            console.error('Mem0 list failed:', errBody);
            return res.status(503).json(buildMem0UnavailableGetPayload(undefined, listResponse.status));
          }

          const memories = await listResponse.json();
          return res.status(200).json(memories);
        }
      }

      case 'POST': {
        const { messages, metadata } = req.body || {};

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({
            error: 'Missing required field: messages (array of {role, content} objects)',
          });
        }

        let addResponse: Response;
        try {
          addResponse = await fetch(`${MEM0_API_BASE}/memories/`, {
            method: 'POST',
            headers: mem0Headers,
            body: JSON.stringify({
              messages,
              user_id: tenantMemoryId,
              ...(metadata ? { metadata } : {}),
            }),
          });
        } catch (error) {
          console.error('Mem0 add failed:', error);
          return res.status(503).json({
            error: 'Mem0 is currently unavailable',
            code: 'mem0_unavailable',
            enabled: true,
            provider: 'mem0',
          });
        }

        if (!addResponse.ok) {
          const errBody = await addResponse.text();
          console.error('Mem0 add failed:', errBody);
          return res.status(503).json({
            error: 'Mem0 is currently unavailable',
            code: 'mem0_unavailable',
            enabled: true,
            provider: 'mem0',
            upstream_status: addResponse.status,
          });
        }

        const result = await addResponse.json();
        return res.status(201).json(result);
      }

      case 'DELETE': {
        const rawMemoryId = req.query?.id;
        const memoryId = Array.isArray(rawMemoryId) ? rawMemoryId[0] : rawMemoryId;

        if (!memoryId) {
          return res.status(400).json({ error: 'Missing required query param: id' });
        }

        let deleteResponse: Response;
        try {
          deleteResponse = await fetch(`${MEM0_API_BASE}/memories/${memoryId}/`, {
            method: 'DELETE',
            headers: mem0Headers,
          });
        } catch (error) {
          console.error('Mem0 delete failed:', error);
          return res.status(503).json({
            error: 'Mem0 is currently unavailable',
            code: 'mem0_unavailable',
            enabled: true,
            provider: 'mem0',
          });
        }

        if (!deleteResponse.ok) {
          const errBody = await deleteResponse.text();
          console.error('Mem0 delete failed:', errBody);
          return res.status(503).json({
            error: 'Mem0 is currently unavailable',
            code: 'mem0_unavailable',
            enabled: true,
            provider: 'mem0',
            upstream_status: deleteResponse.status,
          });
        }

        return res.status(200).json({ deleted: true, id: memoryId });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return errorResponse(res, error);
  }
}
