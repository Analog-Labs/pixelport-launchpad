import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAgentRequest, errorResponse } from '../lib/auth';

const MEM0_API_BASE = 'https://api.mem0.ai/v1';

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
  const mem0ApiKey = process.env.MEM0_API_KEY;
  if (!mem0ApiKey) {
    return res.status(500).json({ error: 'Mem0 API key not configured' });
  }

  try {
    const { tenant } = await authenticateAgentRequest(req);
    const tenantMemoryId = `pixelport-${tenant.id}`;

    const mem0Headers = {
      'Authorization': `Token ${mem0ApiKey}`,
      'Content-Type': 'application/json',
    };

    switch (req.method) {
      case 'GET': {
        const searchQuery = req.query.q as string | undefined;

        if (searchQuery) {
          // Search memories
          const searchResponse = await fetch(`${MEM0_API_BASE}/memories/search/`, {
            method: 'POST',
            headers: mem0Headers,
            body: JSON.stringify({
              query: searchQuery,
              user_id: tenantMemoryId,
            }),
          });

          if (!searchResponse.ok) {
            const errBody = await searchResponse.text();
            console.error('Mem0 search failed:', errBody);
            return res.status(502).json({ error: 'Memory search failed' });
          }

          const results = await searchResponse.json();
          return res.status(200).json(results);
        } else {
          // List all memories
          const listResponse = await fetch(
            `${MEM0_API_BASE}/memories/?user_id=${encodeURIComponent(tenantMemoryId)}`,
            {
              method: 'GET',
              headers: mem0Headers,
            },
          );

          if (!listResponse.ok) {
            const errBody = await listResponse.text();
            console.error('Mem0 list failed:', errBody);
            return res.status(502).json({ error: 'Failed to list memories' });
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

        const addResponse = await fetch(`${MEM0_API_BASE}/memories/`, {
          method: 'POST',
          headers: mem0Headers,
          body: JSON.stringify({
            messages,
            user_id: tenantMemoryId,
            ...(metadata ? { metadata } : {}),
          }),
        });

        if (!addResponse.ok) {
          const errBody = await addResponse.text();
          console.error('Mem0 add failed:', errBody);
          return res.status(502).json({ error: 'Failed to add memory' });
        }

        const result = await addResponse.json();
        return res.status(201).json(result);
      }

      case 'DELETE': {
        const memoryId = req.query.id as string | undefined;

        if (!memoryId) {
          return res.status(400).json({ error: 'Missing required query param: id' });
        }

        const deleteResponse = await fetch(`${MEM0_API_BASE}/memories/${memoryId}/`, {
          method: 'DELETE',
          headers: mem0Headers,
        });

        if (!deleteResponse.ok) {
          const errBody = await deleteResponse.text();
          console.error('Mem0 delete failed:', errBody);
          return res.status(502).json({ error: 'Failed to delete memory' });
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
