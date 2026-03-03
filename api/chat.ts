import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from './lib/auth';
import { supabase } from './lib/supabase';

const GATEWAY_PORT = 18789;

function writeSse(res: VercelResponse, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\\n\\n`);
}

function parseStringQuery(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse | void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    if (tenant.status !== 'active') {
      return res.status(503).json({ error: 'Agent is not yet active', status: tenant.status });
    }

    if (!tenant.droplet_ip || !tenant.gateway_token) {
      return res.status(503).json({ error: 'Agent infrastructure not ready' });
    }

    const body = (req.body ?? {}) as {
      message?: string;
      agent_id?: string;
      session_id?: string;
    };

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'message is required and must be a non-empty string' });
    }

    const agentId = body.agent_id || 'main';
    let activeSessionId = parseStringQuery(body.session_id);

    if (!activeSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          tenant_id: tenant.id,
          agent_id: agentId,
          title: message.slice(0, 100),
        })
        .select('id')
        .single();

      if (sessionError || !newSession) {
        console.error('Session creation error:', sessionError);
        return res.status(500).json({ error: 'Failed to create chat session' });
      }

      activeSessionId = newSession.id;
    } else {
      const { data: existingSession } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', activeSessionId)
        .eq('tenant_id', tenant.id)
        .single();

      if (!existingSession) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
    }

    const { error: userMsgError } = await supabase.from('chat_messages').insert({
      tenant_id: tenant.id,
      session_id: activeSessionId,
      role: 'user',
      content: message,
      agent_id: agentId,
    });

    if (userMsgError) {
      console.error('User message persistence failed:', userMsgError);
    }

    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('tenant_id', tenant.id)
      .eq('session_id', activeSessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    const gatewayUrl = `http://${tenant.droplet_ip}:${GATEWAY_PORT}/openclaw/chat`;
    const gatewayResponse = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.gateway_token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
      },
      body: JSON.stringify({
        message,
        agent_id: agentId,
        history: recentMessages || [],
        stream: true,
      }),
    });

    if (!gatewayResponse.ok) {
      const details = await gatewayResponse.text();
      console.error(`Gateway error (${gatewayResponse.status}):`, details);
      return res.status(502).json({ error: 'Agent gateway error', details });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    writeSse(res, { type: 'session', session_id: activeSessionId });

    let fullAssistantResponse = '';
    const contentType = gatewayResponse.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream') && gatewayResponse.body) {
      const reader = (gatewayResponse.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            let token = '';
            try {
              const parsed = JSON.parse(payload) as Record<string, unknown>;
              token =
                (typeof parsed.content === 'string' && parsed.content) ||
                (typeof parsed.text === 'string' && parsed.text) ||
                (typeof parsed.token === 'string' && parsed.token) ||
                (typeof parsed.delta === 'string' && parsed.delta) ||
                '';
            } catch {
              token = payload;
            }

            if (!token) continue;
            fullAssistantResponse += token;
            writeSse(res, { type: 'token', content: token });
          }
        }
      } catch (streamErr) {
        console.error('Gateway stream read error:', streamErr);
        writeSse(res, { type: 'error', error: 'Stream interrupted' });
      }
    } else {
      try {
        const payload = (await gatewayResponse.json()) as Record<string, unknown>;
        const text =
          (typeof payload.response === 'string' && payload.response) ||
          (typeof payload.message === 'string' && payload.message) ||
          (typeof payload.content === 'string' && payload.content) ||
          JSON.stringify(payload);
        fullAssistantResponse = text;
      } catch {
        const text = await gatewayResponse.text();
        fullAssistantResponse = text;
      }

      if (fullAssistantResponse) {
        writeSse(res, { type: 'token', content: fullAssistantResponse });
      }
    }

    if (!fullAssistantResponse) {
      fullAssistantResponse = '[No response produced]';
    }

    const { data: assistantMsg, error: assistantMsgError } = await supabase
      .from('chat_messages')
      .insert({
        tenant_id: tenant.id,
        session_id: activeSessionId,
        role: 'assistant',
        content: fullAssistantResponse,
        agent_id: agentId,
      })
      .select('id')
      .single();

    if (assistantMsgError) {
      console.error('Assistant message persistence failed:', assistantMsgError);
    }

    await supabase
      .from('chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', activeSessionId)
      .eq('tenant_id', tenant.id);

    writeSse(res, {
      type: 'done',
      message_id: assistantMsg?.id || null,
      session_id: activeSessionId,
    });

    res.end();
    return;
  } catch (error) {
    if (res.headersSent) {
      writeSse(res, { type: 'error', error: 'Internal server error' });
      res.end();
      return;
    }

    return errorResponse(res, error);
  }
}
