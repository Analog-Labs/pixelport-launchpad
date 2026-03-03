import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

function parseBoundedInt(value: string | string[] | undefined, defaultValue: number, max: number): number {
  const str = Array.isArray(value) ? value[0] : value;
  const num = Number.parseInt(str || '', 10);
  if (!Number.isFinite(num) || num < 0) return defaultValue;
  return Math.min(num, max);
}

function parseString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    const sessionId = parseString(req.query.session_id);
    const limit = parseBoundedInt(req.query.limit, 20, 100);
    const offset = parseBoundedInt(req.query.offset, 0, 10000);

    if (sessionId) {
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('id, title, agent_id, created_at, last_message_at')
        .eq('id', sessionId)
        .eq('tenant_id', tenant.id)
        .single();

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const { data: messages, error, count } = await supabase
        .from('chat_messages')
        .select('id, role, content, agent_id, metadata, created_at', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Chat history messages fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch session messages' });
      }

      return res.status(200).json({
        session,
        messages: messages || [],
        total: count || 0,
        limit,
        offset,
      });
    }

    const { data: sessions, error, count } = await supabase
      .from('chat_sessions')
      .select('id, title, agent_id, last_message_at, created_at', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Chat sessions fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch chat sessions' });
    }

    return res.status(200).json({
      sessions: sessions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
