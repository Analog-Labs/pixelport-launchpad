# Codex Slice 3 — API Bridge (Vercel Serverless Routes)

**Priority:** 🟡 Blocked on Slice 2 (schema must exist first)
**Assigned to:** Codex
**Depends on:** Slice 2 (Supabase schema migrated)
**Estimated time:** 3-4 hours

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets a visible AI agent (customizable name/avatar/tone) with invisible sub-agents behind the scenes.

**Where does the API bridge fit?** The API bridge is the middleware layer between the frontend (Lovable-built React app on Vercel) and the backend services (Supabase, LiteLLM, OpenClaw). Every user action in the dashboard — viewing agents, approving content, checking budget — goes through these API routes.

**Auth flow:** Supabase Auth JWT → API route verifies via `supabase.auth.getUser()` → extracts user ID → looks up tenant by `supabase_user_id` → executes operation with tenant isolation.

> **NOTE (2026-03-03):** Auth changed from Clerk to Supabase Auth. This doc has been updated accordingly. Migration 002 renames `clerk_org_id` to `supabase_user_id` — Codex should apply this migration before building the API routes.

**How this connects to other slices:**
- Slice 1 (LiteLLM) provides the LLM gateway URL that some endpoints proxy to
- Slice 2 (Supabase Schema) provides the database tables these routes read/write
- Slice 4 (Provisioning) uses the Inngest client set up in this slice

**Full project docs:**
- Product spec: `docs/pixelport-master-plan-v2.md` (especially Section 3: Architecture)
- Go Package: `docs/phase0/cto-phase0-go-package.md`
- Project coordination: `docs/project-coordination-system.md`

---

## Repository Access

- **Repo:** https://github.com/Analog-Labs/pixelport-launchpad
- **Clone:** `git clone https://github.com/Analog-Labs/pixelport-launchpad.git`
- All work happens in this monorepo — no other repos needed
- Read `CLAUDE.md` first, then `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md`
- After completing work: update SESSION-LOG.md and ACTIVE-PLAN.md, commit and push

---

## What You're Building

A complete set of Vercel serverless API routes in the `api/` directory that:
1. Authenticate requests via Supabase Auth JWT (using `supabase.auth.getUser()`)
2. Resolve the tenant from the Supabase user ID
3. CRUD operations on Supabase tables
4. Proxy chat requests to the OpenClaw gateway
5. Manage LiteLLM teams, keys, and budgets

---

## Deliverables

### Shared Libraries (`api/lib/`)

#### File: `api/lib/auth.ts`
```typescript
/**
 * Supabase Auth JWT verification + tenant resolution.
 * Every API route imports this to authenticate requests.
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify JWT via supabase.auth.getUser(token)
 * 3. Extract user.id from the verified user
 * 4. Look up tenant in Supabase by supabase_user_id
 * 5. Return tenant object (or throw 401/404)
 *
 * NOTE: Uses a service-role Supabase client to call auth.getUser()
 * and to query the tenants table (bypasses RLS).
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface Tenant {
  id: string;
  supabase_user_id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  droplet_id: string | null;
  droplet_ip: string | null;
  gateway_token: string | null;
  litellm_team_id: string | null;
  agentmail_inbox: string | null;
  onboarding_data: Record<string, any>;
  settings: Record<string, any>;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResult {
  tenant: Tenant;
  userId: string;
}

/**
 * Verify Supabase Auth JWT and resolve tenant.
 * Throws on auth failure — callers should catch and return appropriate HTTP status.
 */
export async function authenticateRequest(req: VercelRequest): Promise<AuthResult> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);

  // Verify JWT with Supabase Auth
  // getUser() validates the token server-side and returns the user object
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new AuthError('Invalid or expired token', 401);
  }

  // Look up tenant by Supabase user ID
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('supabase_user_id', user.id)
    .single();

  if (error || !tenant) {
    throw new AuthError('Tenant not found for this user', 404);
  }

  return {
    tenant: tenant as Tenant,
    userId: user.id,
  };
}

export class AuthError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Standard error response helper.
 */
export function errorResponse(res: any, error: unknown) {
  if (error instanceof AuthError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error('Unexpected error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}
```

#### File: `api/lib/supabase.ts`
```typescript
/**
 * Supabase client (service role).
 * Used by all API routes for database operations.
 * Service role bypasses RLS — auth is handled at the API layer.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

#### File: `api/lib/gateway.ts`
```typescript
/**
 * OpenClaw gateway proxy helper.
 * Forwards requests to a tenant's OpenClaw instance.
 * Each tenant has their own droplet running OpenClaw.
 */

import type { Tenant } from './auth';

const GATEWAY_PORT = 18789;

export async function proxyToGateway(
  tenant: Tenant,
  path: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
) {
  if (!tenant.droplet_ip) {
    throw new Error('Tenant does not have a provisioned droplet');
  }
  if (!tenant.gateway_token) {
    throw new Error('Tenant does not have a gateway token');
  }

  const url = `http://${tenant.droplet_ip}:${GATEWAY_PORT}${path}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${tenant.gateway_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway error (${response.status}): ${errorText}`);
  }

  return response.json();
}
```

### API Routes

Each route file exports a default handler function for Vercel serverless.

#### File: `api/tenants/me.ts`
```typescript
/**
 * GET /api/tenants/me
 * Returns the current tenant's profile.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    // Strip sensitive fields before returning
    const { gateway_token, ...safeTenant } = tenant;
    return res.status(200).json(safeTenant);
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/tenants/onboarding.ts`
```typescript
/**
 * POST /api/tenants/me/onboarding
 * Saves onboarding data (schema-free JSONB).
 * Frontend sends whatever the AI onboarding conversation produces.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const onboardingData = req.body;

    if (!onboardingData || typeof onboardingData !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({ onboarding_data: onboardingData })
      .eq('id', tenant.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save onboarding data' });
    }

    return res.status(200).json({ success: true, onboarding_data: data.onboarding_data });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/tenants/status.ts`
```typescript
/**
 * GET /api/tenants/me/status
 * Returns provisioning status for the current tenant.
 * Used by the dashboard to show progress during initial setup.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    return res.status(200).json({
      status: tenant.status,
      has_droplet: !!tenant.droplet_id,
      has_gateway: !!tenant.gateway_token,
      has_litellm: !!tenant.litellm_team_id,
      has_agentmail: !!tenant.agentmail_inbox,
      trial_ends_at: tenant.trial_ends_at,
      plan: tenant.plan,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/agents/index.ts`
```typescript
/**
 * GET /api/agents
 * Returns all agents for the current tenant.
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

    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }

    return res.status(200).json(agents);
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/agents/[id].ts`
```typescript
/**
 * GET /api/agents/:id — Get a specific agent
 * PATCH /api/agents/:id — Update agent settings (name, tone, avatar)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { tenant } = await authenticateRequest(req);
    const agentId = req.query.id as string;

    if (req.method === 'GET') {
      const { data: agent, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('tenant_id', tenant.id)
        .single();

      if (error || !agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      return res.status(200).json(agent);
    }

    if (req.method === 'PATCH') {
      // Only allow updating specific fields
      const allowedFields = ['display_name', 'tone', 'avatar_url', 'settings'];
      const updates: Record<string, any> = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { data: agent, error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', agentId)
        .eq('tenant_id', tenant.id)
        .select()
        .single();

      if (error || !agent) {
        return res.status(404).json({ error: 'Agent not found or update failed' });
      }

      return res.status(200).json(agent);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/content/index.ts`
```typescript
/**
 * GET /api/content — List content items for the current tenant
 * Supports query params: ?status=pending_review&type=post&limit=20&offset=0
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

    const status = req.query.status as string | undefined;
    const contentType = req.query.type as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let query = supabase
      .from('content_items')
      .select('*, agents(display_name, avatar_url)', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (contentType) query = query.eq('content_type', contentType);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch content' });
    }

    return res.status(200).json({ items: data, total: count, limit, offset });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/content/[id].ts`
```typescript
/**
 * GET /api/content/:id — Get a specific content item
 * PATCH /api/content/:id — Update content item (edit, approve, reject)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { tenant, userId } = await authenticateRequest(req);
    const contentId = req.query.id as string;

    if (req.method === 'GET') {
      const { data: item, error } = await supabase
        .from('content_items')
        .select('*, agents(display_name, avatar_url)')
        .eq('id', contentId)
        .eq('tenant_id', tenant.id)
        .single();

      if (error || !item) {
        return res.status(404).json({ error: 'Content item not found' });
      }

      return res.status(200).json(item);
    }

    if (req.method === 'PATCH') {
      const { action, ...updates } = req.body;

      // Handle approval actions
      if (action === 'approve' || action === 'reject' || action === 'request_revision') {
        const statusMap: Record<string, string> = {
          approve: 'approved',
          reject: 'rejected',
          request_revision: 'draft',
        };

        // Update content item status
        const { error: contentError } = await supabase
          .from('content_items')
          .update({
            status: statusMap[action],
            feedback: updates.feedback || null,
            revision_count: action === 'request_revision'
              ? supabase.rpc('increment_revision', { row_id: contentId }) // or handle in app
              : undefined,
          })
          .eq('id', contentId)
          .eq('tenant_id', tenant.id);

        if (contentError) {
          return res.status(500).json({ error: 'Failed to update content' });
        }

        // Create approval record
        const { error: approvalError } = await supabase
          .from('approvals')
          .insert({
            tenant_id: tenant.id,
            content_item_id: contentId,
            status: statusMap[action],
            decided_by: userId,
            decided_at: new Date().toISOString(),
            feedback: updates.feedback || null,
          });

        if (approvalError) {
          console.error('Failed to create approval record:', approvalError);
          // Non-fatal — content status already updated
        }

        return res.status(200).json({ success: true, new_status: statusMap[action] });
      }

      // Handle regular updates (title, body, etc.)
      const allowedFields = ['title', 'body', 'scheduled_for', 'metadata'];
      const safeUpdates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          safeUpdates[field] = updates[field];
        }
      }

      const { data: item, error } = await supabase
        .from('content_items')
        .update(safeUpdates)
        .eq('id', contentId)
        .eq('tenant_id', tenant.id)
        .select()
        .single();

      if (error || !item) {
        return res.status(404).json({ error: 'Content item not found or update failed' });
      }

      return res.status(200).json(item);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/approvals/index.ts`
```typescript
/**
 * GET /api/approvals — List pending approvals for current tenant
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

    const { data: approvals, error } = await supabase
      .from('approvals')
      .select('*, content_items(title, content_type, platform, status)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch approvals' });
    }

    return res.status(200).json(approvals);
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/approvals/[id]/decide.ts`
```typescript
/**
 * POST /api/approvals/:id/decide
 * Approve or reject a pending approval.
 * Body: { decision: "approved" | "rejected" | "revision_requested", feedback?: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant, userId } = await authenticateRequest(req);
    const approvalId = req.query.id as string;
    const { decision, feedback } = req.body;

    if (!['approved', 'rejected', 'revision_requested'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be: approved, rejected, or revision_requested' });
    }

    // Update the approval
    const { data: approval, error: approvalError } = await supabase
      .from('approvals')
      .update({
        status: decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        feedback: feedback || null,
      })
      .eq('id', approvalId)
      .eq('tenant_id', tenant.id)
      .select('*, content_items(id)')
      .single();

    if (approvalError || !approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // Update the content item status to match
    const contentStatusMap: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      revision_requested: 'draft',
    };

    await supabase
      .from('content_items')
      .update({ status: contentStatusMap[decision], feedback })
      .eq('id', approval.content_items?.id)
      .eq('tenant_id', tenant.id);

    // TODO: In Phase 1, send Inngest event here for workflow continuation
    // e.g., inngest.send({ name: 'approval.decided', data: { approvalId, decision } })

    return res.status(200).json({ success: true, approval });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/chat.ts`
```typescript
/**
 * POST /api/chat
 * Proxy chat messages to the tenant's OpenClaw gateway.
 * The frontend chat widget sends messages here, and we forward to the agent.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from './lib/auth';
import { proxyToGateway } from './lib/gateway';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    if (tenant.status !== 'active') {
      return res.status(503).json({
        error: 'Agent is not yet active',
        status: tenant.status,
      });
    }

    const { message, agent_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Forward to OpenClaw gateway
    const response = await proxyToGateway(tenant, '/openclaw/chat', {
      method: 'POST',
      body: {
        message,
        agent_id: agent_id || 'main', // Default to main agent (Chief of Staff)
      },
    });

    return res.status(200).json(response);
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/settings/index.ts`
```typescript
/**
 * GET /api/settings — Get tenant settings
 * PATCH /api/settings — Update tenant settings
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { tenant } = await authenticateRequest(req);

    if (req.method === 'GET') {
      return res.status(200).json({
        settings: tenant.settings,
        plan: tenant.plan,
        trial_ends_at: tenant.trial_ends_at,
        agentmail_inbox: tenant.agentmail_inbox,
      });
    }

    if (req.method === 'PATCH') {
      // Merge new settings with existing (don't replace entirely)
      const newSettings = { ...tenant.settings, ...req.body.settings };

      const { data, error } = await supabase
        .from('tenants')
        .update({ settings: newSettings })
        .eq('id', tenant.id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: 'Failed to update settings' });
      }

      return res.status(200).json({ settings: data.settings });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/settings/api-keys.ts`
```typescript
/**
 * GET /api/settings/api-keys — List BYO API keys (with masked values)
 * POST /api/settings/api-keys — Add a new BYO API key
 * DELETE /api/settings/api-keys — Remove a BYO API key
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

// Simple encryption/decryption using Node.js crypto
// In production, use a proper key management solution
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY!; // 32-byte hex key

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { tenant } = await authenticateRequest(req);

    if (req.method === 'GET') {
      const { data: keys, error } = await supabase
        .from('api_keys')
        .select('id, provider, key_alias, key_hint, is_active, created_at')
        .eq('tenant_id', tenant.id);

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch API keys' });
      }

      return res.status(200).json(keys);
    }

    if (req.method === 'POST') {
      const { provider, key_alias, api_key } = req.body;

      if (!provider || !api_key) {
        return res.status(400).json({ error: 'provider and api_key are required' });
      }

      if (!['openai', 'anthropic', 'google'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider. Must be: openai, anthropic, or google' });
      }

      const encrypted = encrypt(api_key);
      const hint = '...' + api_key.slice(-4);

      const { data, error } = await supabase
        .from('api_keys')
        .upsert({
          tenant_id: tenant.id,
          provider,
          key_alias: key_alias || `${provider} key`,
          encrypted_key: encrypted,
          key_hint: hint,
          is_active: true,
        }, {
          onConflict: 'tenant_id,provider',
        })
        .select('id, provider, key_alias, key_hint, is_active')
        .single();

      if (error) {
        return res.status(500).json({ error: 'Failed to save API key' });
      }

      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { provider } = req.body;

      if (!provider) {
        return res.status(400).json({ error: 'provider is required' });
      }

      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('provider', provider);

      if (error) {
        return res.status(500).json({ error: 'Failed to delete API key' });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/settings/budget.ts`
```typescript
/**
 * GET /api/settings/budget — Get current budget usage
 * PATCH /api/settings/budget — Update budget cap (admin only in future)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';

const LITELLM_URL = process.env.LITELLM_URL!;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { tenant } = await authenticateRequest(req);

    if (req.method === 'GET') {
      if (!tenant.litellm_team_id) {
        return res.status(200).json({
          budget_usd: tenant.settings.trial_budget_usd || 20,
          spend_usd: 0,
          remaining_usd: tenant.settings.trial_budget_usd || 20,
          litellm_connected: false,
        });
      }

      // Fetch spend from LiteLLM
      const teamResponse = await fetch(
        `${LITELLM_URL}/team/info?team_id=${tenant.litellm_team_id}`,
        { headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` } }
      );

      if (!teamResponse.ok) {
        return res.status(500).json({ error: 'Failed to fetch budget info from LiteLLM' });
      }

      const teamData = await teamResponse.json();
      const budget = tenant.settings.trial_budget_usd || 20;
      const spend = teamData.spend || 0;

      return res.status(200).json({
        budget_usd: budget,
        spend_usd: spend,
        remaining_usd: Math.max(0, budget - spend),
        litellm_connected: true,
      });
    }

    if (req.method === 'PATCH') {
      const { trial_budget_usd } = req.body;

      if (typeof trial_budget_usd !== 'number' || trial_budget_usd < 0) {
        return res.status(400).json({ error: 'trial_budget_usd must be a non-negative number' });
      }

      // Update tenant settings
      const newSettings = { ...tenant.settings, trial_budget_usd };

      const { error: dbError } = await supabase
        .from('tenants')
        .update({ settings: newSettings })
        .eq('id', tenant.id);

      if (dbError) {
        return res.status(500).json({ error: 'Failed to update budget' });
      }

      // Update LiteLLM team budget if connected
      if (tenant.litellm_team_id) {
        await fetch(`${LITELLM_URL}/team/update`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team_id: tenant.litellm_team_id,
            max_budget: trial_budget_usd,
          }),
        });
      }

      return res.status(200).json({ success: true, trial_budget_usd });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

#### File: `api/inngest/client.ts`
```typescript
/**
 * Inngest client setup.
 * Used by the provisioning workflow (Slice 4) and future workflows.
 */
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'pixelport',
  // Inngest Cloud event key — set in environment
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

---

## Environment Variables Needed

Add these to Vercel (or `.env.local` for local dev):

```bash
# Supabase (also used for auth verification — no separate auth vendor needed)
SUPABASE_PROJECT_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LiteLLM (from Slice 1 deployment)
LITELLM_URL=https://your-litellm.railway.app
LITELLM_MASTER_KEY=sk-your-litellm-master-key

# API Key Encryption
API_KEY_ENCRYPTION_KEY=your-64-char-hex-key  # Generate: openssl rand -hex 32

# Inngest
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key
```

---

## Verification Checklist

After committing all files, verify:

### 1. TypeScript Compiles
```bash
npx tsc --noEmit api/**/*.ts
# Expected: no errors
```

### 2. Endpoint Inventory
Verify all routes exist:
- `api/tenants/me.ts` — GET
- `api/tenants/onboarding.ts` — POST
- `api/tenants/status.ts` — GET
- `api/agents/index.ts` — GET
- `api/agents/[id].ts` — GET, PATCH
- `api/content/index.ts` — GET
- `api/content/[id].ts` — GET, PATCH
- `api/approvals/index.ts` — GET
- `api/approvals/[id]/decide.ts` — POST
- `api/chat.ts` — POST
- `api/settings/index.ts` — GET, PATCH
- `api/settings/api-keys.ts` — GET, POST, DELETE
- `api/settings/budget.ts` — GET, PATCH
- `api/inngest/client.ts` — (shared library)

### 3. Auth Pattern Consistent
Every route handler should:
1. Call `authenticateRequest(req)` first
2. Use `tenant.id` for all Supabase queries (tenant isolation)
3. Wrap errors with `errorResponse(res, error)`

### 4. No Secrets in Code
Grep for potential secrets:
```bash
grep -r "sk-\|sk_test\|supabase\.\w*\.co" api/
# Expected: only references to process.env, never actual values
```

---

## Success Criteria

- [ ] All 14 API route files created in `api/` directory
- [ ] 3 shared library files created in `api/lib/`
- [ ] TypeScript compiles without errors
- [ ] Every route uses `authenticateRequest()` for auth
- [ ] Every Supabase query filters by `tenant_id` (tenant isolation)
- [ ] No secrets hardcoded in source files
- [ ] Sensitive fields (gateway_token, encrypted_key) never exposed in responses
- [ ] `api/inngest/client.ts` ready for Slice 4 to use

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`** — add a new "Last Session" entry:
   - Date, who worked (Codex), what was done (be specific: X files created, TypeScript compiles, all routes implemented)
   - What's next (Slice 4: Provisioning + Inngest)
   - Any blockers or observations

2. **Update `docs/ACTIVE-PLAN.md`** — check off:
   - `[x] 0.5: API bridge routes in api/ directory`

3. **Feedback for CTO** — In your SESSION-LOG entry, include a "Feedback & Observations" section:
   - Any architectural concerns
   - Suggestions for improvement (e.g., shared validation, middleware patterns)
   - Edge cases you noticed
   - Questions about Supabase Auth integration, query patterns, or gateway proxy

4. **Commit and push** all changes to the monorepo.

---

## Important Reminders

- **Do NOT touch Lovable frontend files** in `src/` — those are managed by the founder
- **Every Supabase query must filter by tenant_id** — this is how we maintain data isolation
- **The Inngest client setup** (`api/inngest/client.ts`) is minimal here — Slice 4 adds the actual workflow functions
- **Supabase Auth JWT verification** is the primary auth mechanism — RLS is defense-in-depth backup
- **The chat proxy** (`api/chat.ts`) forwards to OpenClaw on the tenant's droplet — this only works after provisioning (Slice 4)
- Install required packages: `@supabase/supabase-js`, `inngest`, `@vercel/node` (no Clerk — auth uses Supabase)
- **Pre-requisite:** Apply migration 002 (`supabase/migrations/002_clerk_to_supabase_auth.sql`) before building routes — this renames `clerk_org_id` to `supabase_user_id`
