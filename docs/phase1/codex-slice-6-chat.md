# Codex Slice 6 — Chat API Streaming (SSE) + Message History

**Priority:** 🟡 Partially blocked (needs OpenClaw gateway accessible for live testing)
**Assigned to:** Codex
**Depends on:** Slice 5 (tenant creation — so a test tenant exists)
**Estimated time:** 3-4 hours

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets a visible AI agent (customizable name/avatar/tone) with invisible sub-agents behind the scenes.

**Where does this slice fit?** The dashboard has a chat widget (persistent sidebar) and a full-page chat view (`/dashboard/chat`). Currently, `api/chat.ts` (built in Slice 3) proxies chat messages to OpenClaw and returns a JSON response. This slice upgrades it to:

1. **Server-Sent Events (SSE) streaming** — agent responses stream token-by-token to the frontend
2. **Message history** — chat messages are stored in Supabase so the user can see conversation history
3. **Session management** — conversations are grouped into sessions for context

**Current state:** `api/chat.ts` exists and works as a simple JSON proxy:
- POST body: `{ message, agent_id }`
- Returns: JSON response from OpenClaw
- Problem: No streaming, no history, no sessions

**How this connects to other slices:**
- Slice 3 provided the initial `api/chat.ts` — this slice replaces/upgrades it
- Slice 5 provides tenant creation — a tenant must exist to chat
- The frontend chat widget (Founder Track, built in Lovable) will consume this API

**Full project docs:**
- Product spec: `docs/pixelport-master-plan-v2.md` (Section 15, Phase 1 items 1.7)
- Active plan: `docs/ACTIVE-PLAN.md` (items 1.C2, 1.I2)

---

## Repository Access

- **Repo:** https://github.com/Analog-Labs/pixelport-launchpad
- **Branch:** Work on `main` (or create `codex/phase1-slice-6`)
- Read `CLAUDE.md` first, then `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md`
- After completing work: update SESSION-LOG.md and ACTIVE-PLAN.md, commit and push

---

## What You're Building

### 1. Database Migration — Chat Messages Table

**File: `supabase/migrations/004_chat_messages.sql`** (NEW)

```sql
-- Chat messages table for conversation history
-- Each message belongs to a tenant and a session

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  agent_id text NOT NULL DEFAULT 'main',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_chat_messages_tenant_session
  ON chat_messages(tenant_id, session_id, created_at ASC);

CREATE INDEX idx_chat_messages_tenant_recent
  ON chat_messages(tenant_id, created_at DESC);

-- RLS (defense-in-depth — API routes use service role)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for chat_messages"
  ON chat_messages
  FOR ALL
  USING (tenant_id = auth.uid()::uuid);

-- Chat sessions table for grouping conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text,
  agent_id text NOT NULL DEFAULT 'main',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_tenant
  ON chat_sessions(tenant_id, last_message_at DESC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for chat_sessions"
  ON chat_sessions
  FOR ALL
  USING (tenant_id = auth.uid()::uuid);

COMMENT ON TABLE chat_messages IS 'Chat messages between users and AI agents. Each message belongs to a session.';
COMMENT ON TABLE chat_sessions IS 'Chat sessions group related messages into conversations.';
```

**Apply this migration to Supabase:**
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/004_chat_messages.sql
```

Connection details (use pooler endpoint):
- Host: `aws-0-us-west-1.pooler.supabase.com`
- Port: `6543`
- Database: `postgres`
- User: `postgres.ecgzlfqhdzzfikvbrwna`
- Password: `m6UYUL4yLWNpHKB7`

### 2. Chat Streaming Endpoint (SSE)

**File: `api/chat.ts`** (REPLACE existing file)

Replace the current JSON proxy with an SSE streaming endpoint:

```typescript
/**
 * POST /api/chat — Send a message and stream the response via SSE
 *
 * The frontend sends a message, we:
 * 1. Authenticate the user
 * 2. Create/resume a chat session
 * 3. Store the user message in chat_messages
 * 4. Forward to OpenClaw gateway
 * 5. Stream the response back via SSE
 * 6. Store the complete assistant response when done
 *
 * SSE format:
 *   data: {"type":"token","content":"Hello"}
 *   data: {"type":"token","content":" world"}
 *   data: {"type":"done","message_id":"uuid","session_id":"uuid"}
 *   data: {"type":"error","error":"Something went wrong"}
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from './lib/auth';
import { supabase } from './lib/supabase';

const GATEWAY_PORT = 18789;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const { message, agent_id, session_id } = (req.body || {}) as {
      message?: string;
      agent_id?: string;
      session_id?: string;
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required and must be a string' });
    }

    const agentId = agent_id || 'main';

    // 1. Create or resume session
    let activeSessionId = session_id;

    if (!activeSessionId) {
      // Create a new session
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          tenant_id: tenant.id,
          agent_id: agentId,
          title: message.slice(0, 100), // Use first message as title
        })
        .select('id')
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        return res.status(500).json({ error: 'Failed to create chat session' });
      }

      activeSessionId = newSession.id;
    } else {
      // Verify session belongs to tenant
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

    // 2. Store user message
    const { data: userMsg, error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        tenant_id: tenant.id,
        session_id: activeSessionId,
        role: 'user',
        content: message,
        agent_id: agentId,
      })
      .select('id')
      .single();

    if (userMsgError) {
      console.error('User message save error:', userMsgError);
      // Non-fatal — continue with chat even if save fails
    }

    // 3. Load recent conversation history for context
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('tenant_id', tenant.id)
      .eq('session_id', activeSessionId)
      .order('created_at', { ascending: true })
      .limit(20); // Last 20 messages for context

    // 4. Forward to OpenClaw gateway
    const gatewayUrl = `http://${tenant.droplet_ip}:${GATEWAY_PORT}/openclaw/chat`;

    const gatewayResponse = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tenant.gateway_token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        agent_id: agentId,
        history: recentMessages || [],
        stream: true,
      }),
    });

    if (!gatewayResponse.ok) {
      const errorText = await gatewayResponse.text();
      console.error(`Gateway error (${gatewayResponse.status}):`, errorText);
      return res.status(502).json({ error: 'Agent gateway error', details: errorText });
    }

    // 5. Stream response via SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send session_id to frontend immediately
    res.write(`data: ${JSON.stringify({ type: 'session', session_id: activeSessionId })}\n\n`);

    let fullResponse = '';

    // Check if gateway returned SSE stream or JSON
    const contentType = gatewayResponse.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream') && gatewayResponse.body) {
      // Gateway supports streaming — pipe through
      const reader = gatewayResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          // Forward SSE chunks to client
          // Parse individual tokens from the chunk if possible
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content || data.text || data.token) {
                  const token = data.content || data.text || data.token;
                  res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
                }
              } catch {
                // Not JSON — forward raw text as token
                const text = line.slice(6).trim();
                if (text && text !== '[DONE]') {
                  res.write(`data: ${JSON.stringify({ type: 'token', content: text })}\n\n`);
                  fullResponse = text; // Overwrite — this is the full response
                }
              }
            }
          }
        }
      } catch (streamError) {
        console.error('Stream read error:', streamError);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`);
      }
    } else {
      // Gateway returned JSON — send as single message
      try {
        const jsonResponse = await gatewayResponse.json();
        const responseText = jsonResponse.response || jsonResponse.message || jsonResponse.content || JSON.stringify(jsonResponse);
        fullResponse = responseText;

        // Send as token chunks (simulate streaming for consistent frontend handling)
        res.write(`data: ${JSON.stringify({ type: 'token', content: responseText })}\n\n`);
      } catch (parseError) {
        const textResponse = await gatewayResponse.text();
        fullResponse = textResponse;
        res.write(`data: ${JSON.stringify({ type: 'token', content: textResponse })}\n\n`);
      }
    }

    // 6. Store assistant response
    const { data: assistantMsg } = await supabase
      .from('chat_messages')
      .insert({
        tenant_id: tenant.id,
        session_id: activeSessionId,
        role: 'assistant',
        content: fullResponse,
        agent_id: agentId,
      })
      .select('id')
      .single();

    // Update session last_message_at
    await supabase
      .from('chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', activeSessionId);

    // Send done event
    res.write(`data: ${JSON.stringify({
      type: 'done',
      message_id: assistantMsg?.id || null,
      session_id: activeSessionId,
    })}\n\n`);

    res.end();

  } catch (error) {
    // If headers already sent (streaming started), send error via SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
      res.end();
    } else {
      return errorResponse(res, error);
    }
  }
}
```

### 3. Chat History Endpoint

**File: `api/chat/history.ts`** (NEW)

```typescript
/**
 * GET /api/chat/history — Get chat sessions and messages
 *
 * Query params:
 *   ?session_id=uuid — Get messages for a specific session
 *   ?limit=20 — Number of sessions or messages to return
 *   ?offset=0 — Pagination offset
 *
 * Without session_id: returns list of sessions
 * With session_id: returns messages in that session
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    const sessionId = req.query.session_id as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (sessionId) {
      // Verify session belongs to tenant
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('id, title, agent_id, created_at')
        .eq('id', sessionId)
        .eq('tenant_id', tenant.id)
        .single();

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get messages for this session
      const { data: messages, error, count } = await supabase
        .from('chat_messages')
        .select('id, role, content, agent_id, created_at, metadata', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Messages fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }

      return res.status(200).json({
        session,
        messages: messages || [],
        total: count,
        limit,
        offset,
      });
    }

    // No session_id — return list of sessions
    const { data: sessions, error, count } = await supabase
      .from('chat_sessions')
      .select('id, title, agent_id, last_message_at, created_at', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Sessions fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }

    return res.status(200).json({
      sessions: sessions || [],
      total: count,
      limit,
      offset,
    });

  } catch (error) {
    return errorResponse(res, error);
  }
}
```

---

## API Contract

### `POST /api/chat` (Streaming)

**Headers:**
```
Authorization: Bearer <supabase-jwt>
Content-Type: application/json
```

**Request body:**
```json
{
  "message": "What should our social media strategy focus on?",
  "agent_id": "main",
  "session_id": "uuid-or-null"
}
```

**Response:** SSE stream
```
data: {"type":"session","session_id":"uuid"}

data: {"type":"token","content":"Based on"}
data: {"type":"token","content":" your company's"}
data: {"type":"token","content":" profile..."}

data: {"type":"done","message_id":"uuid","session_id":"uuid"}
```

### `GET /api/chat/history`

**List sessions:**
```
GET /api/chat/history
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "Social media strategy",
      "agent_id": "main",
      "last_message_at": "2026-03-10T12:00:00Z",
      "created_at": "2026-03-10T11:00:00Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

**Get session messages:**
```
GET /api/chat/history?session_id=uuid
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "session": { "id": "uuid", "title": "...", "agent_id": "main", "created_at": "..." },
  "messages": [
    { "id": "uuid", "role": "user", "content": "What should...", "agent_id": "main", "created_at": "..." },
    { "id": "uuid", "role": "assistant", "content": "Based on...", "agent_id": "main", "created_at": "..." }
  ],
  "total": 12,
  "limit": 20,
  "offset": 0
}
```

---

## Verification Checklist

### 1. TypeScript Compiles
```bash
npx tsc --noEmit api/chat.ts api/chat/history.ts
```

### 2. Migration Applied
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('chat_messages', 'chat_sessions');
-- Expected: both tables exist
```

### 3. Auth Pattern Consistent
Both endpoints use `authenticateRequest()` and scope all queries by `tenant_id`.

### 4. SSE Format Correct
Verify the response format matches:
```
data: {"type":"token","content":"..."}\n\n
data: {"type":"done","message_id":"...","session_id":"..."}\n\n
```

### 5. Message Persistence
After a chat exchange, verify messages exist in `chat_messages` table:
```sql
SELECT role, content, session_id FROM chat_messages
WHERE tenant_id = '<test-tenant-id>'
ORDER BY created_at ASC;
```

### 6. No Secrets in Code
```bash
grep -r "sk-\|eyJ\|supabase\.\w*\.co" api/chat.ts api/chat/
```

---

## Success Criteria

- [ ] Migration 004 creates `chat_messages` and `chat_sessions` tables
- [ ] `api/chat.ts` upgraded to SSE streaming
- [ ] `api/chat/history.ts` created with session list + message history
- [ ] User messages stored before gateway call
- [ ] Assistant responses stored after streaming complete
- [ ] Sessions auto-created on first message
- [ ] All queries scoped by `tenant_id`
- [ ] TypeScript compiles without errors
- [ ] No hardcoded secrets
- [ ] Graceful fallback when gateway returns JSON instead of SSE

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`** — add session entry
2. **Update `docs/ACTIVE-PLAN.md`** — check off `1.C2`
3. **Feedback for CTO** — include:
   - Did OpenClaw gateway support SSE streaming? (If not accessible, note what was mocked)
   - Any issues with Vercel SSE (Vercel serverless has timeout limits — note if this is a concern)
   - Observations about message storage performance
4. **Commit and push**

---

## Important Reminders

- **Do NOT touch Lovable frontend files** in `src/`
- **Vercel serverless timeout**: Default is 10 seconds (Hobby) or 60 seconds (Pro). SSE streaming may need Vercel Pro or a different approach (Edge Functions). Note this in feedback if relevant.
- **OpenClaw chat format**: The gateway may or may not support SSE natively. The code handles both SSE and JSON responses gracefully.
- **The existing `api/chat.ts`** should be **replaced** (not a new file alongside it)
- **Session titles** are auto-generated from the first message (truncated to 100 chars)
- If you cannot test against a live OpenClaw gateway (DO quota blocker), focus on the Supabase operations and note the gateway integration as "untested pending infrastructure"
