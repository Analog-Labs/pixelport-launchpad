# Codex Slice 7 — Slack OAuth Flow + Webhook

**Priority:** 🔴 Blocked — requires Slack App credentials from founder
**Assigned to:** Codex
**Depends on:** Slice 5 (tenant must exist), Slack App credentials
**Estimated time:** 3-4 hours

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets a visible AI agent that works in their Slack workspace + dashboard + email.

**Where does this slice fit?** Slack is a core channel for the AI Chief of Staff. During onboarding (Step 3: "Connect Slack"), the customer authorizes PixelPort to access their Slack workspace. This slice builds:

1. **Slack OAuth flow** — user clicks "Connect Slack" → redirected to Slack authorization → callback stores credentials
2. **Slack webhook receiver** — receives events from Slack (messages, mentions) and forwards to the tenant's OpenClaw agent
3. **Connections status API** — frontend can check which integrations are connected

**Current state:** The API bridge (Slice 3) has a placeholder `api/connections/` structure but no Slack-specific logic. The `ACTIVE-PLAN.md` lists this as item 1.C3 and 1.I4.

**How this connects to other slices:**
- Slice 5 provides tenant creation — a tenant must exist before connecting Slack
- The frontend Connections page (Founder Track F5) shows connected integrations
- After Slack is connected, OpenClaw on the tenant's droplet uses Slack Socket Mode (configured during provisioning)

**Full project docs:**
- Product spec: `docs/pixelport-master-plan-v2.md` (Section 15, Phase 1 item 1.8)
- Active plan: `docs/ACTIVE-PLAN.md` (items 1.C3, 1.I4)

---

## Repository Access

- **Repo:** https://github.com/Analog-Labs/pixelport-launchpad
- **Branch:** Work on `main` (or create `codex/phase1-slice-7`)
- Read `CLAUDE.md` first, then `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md`
- After completing work: update SESSION-LOG.md and ACTIVE-PLAN.md, commit and push

---

## Prerequisites (Founder Must Do First)

Before Codex can execute this slice, the founder needs to:

1. **Create a Slack App** at https://api.slack.com/apps
   - App name: "PixelPort" (or "PixelPort AI")
   - Enable OAuth & Permissions
   - Add redirect URL: `https://pixelport-launchpad.vercel.app/api/connections/slack/callback`
   - Add bot scopes: `channels:history`, `channels:read`, `chat:write`, `im:history`, `im:read`, `im:write`, `users:read`, `app_mentions:read`
   - Enable Event Subscriptions (URL: `https://pixelport-launchpad.vercel.app/api/connections/slack/events`)
   - Subscribe to bot events: `app_mention`, `message.im`
   - Enable Socket Mode (for per-tenant droplet connections)

2. **Share credentials with CTO:**
   - `SLACK_CLIENT_ID`
   - `SLACK_CLIENT_SECRET`
   - `SLACK_SIGNING_SECRET`

---

## What You're Building

### 1. Database Migration — Slack Connections

**File: `supabase/migrations/005_slack_connections.sql`** (NEW)

```sql
-- Slack workspace connections per tenant
CREATE TABLE IF NOT EXISTS slack_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id text NOT NULL,         -- Slack workspace ID (T...)
  team_name text,                -- Slack workspace name
  bot_token text NOT NULL,       -- encrypted xoxb-... token
  bot_user_id text,              -- Bot's Slack user ID (U...)
  installer_user_id text,        -- User who installed the app
  scopes text[],                 -- Granted OAuth scopes
  is_active boolean DEFAULT true,
  connected_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One Slack workspace per tenant (for now)
CREATE UNIQUE INDEX idx_slack_connections_tenant
  ON slack_connections(tenant_id);

-- Look up by Slack team_id (for incoming webhooks)
CREATE INDEX idx_slack_connections_team
  ON slack_connections(team_id);

ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for slack_connections"
  ON slack_connections
  FOR ALL
  USING (tenant_id = auth.uid()::uuid);

-- Add updated_at trigger (reuse existing function from tenants)
CREATE TRIGGER set_slack_connections_updated_at
  BEFORE UPDATE ON slack_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE slack_connections IS 'Slack workspace OAuth connections. One workspace per tenant.';
```

**Apply to Supabase** using the same pooler connection as previous migrations.

### 2. Slack OAuth Install Endpoint

**File: `api/connections/slack/install.ts`** (NEW)

```typescript
/**
 * GET /api/connections/slack/install
 *
 * Initiates Slack OAuth flow. Redirects the user to Slack's authorization page.
 * The `state` parameter encodes the tenant ID for the callback to use.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Generate state token (contains tenant_id, signed)
 * 3. Redirect to Slack OAuth authorize URL
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../../lib/auth';
import { createHmac } from 'crypto';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const STATE_SECRET = process.env.SLACK_STATE_SECRET || process.env.API_KEY_ENCRYPTION_KEY!;

// Bot scopes needed for Chief of Staff
const BOT_SCOPES = [
  'channels:history',
  'channels:read',
  'chat:write',
  'im:history',
  'im:read',
  'im:write',
  'users:read',
  'app_mentions:read',
].join(',');

/**
 * Generate a signed state token containing the tenant ID.
 * Format: tenantId.timestamp.signature
 */
function generateState(tenantId: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${tenantId}.${timestamp}`;
  const signature = createHmac('sha256', STATE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16); // Short signature is fine for OAuth state
  return `${payload}.${signature}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);

    const state = generateState(tenant.id);

    const redirectUrl = process.env.SLACK_REDIRECT_URI
      || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/connections/slack/callback`;

    const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackAuthUrl.searchParams.set('client_id', SLACK_CLIENT_ID);
    slackAuthUrl.searchParams.set('scope', BOT_SCOPES);
    slackAuthUrl.searchParams.set('redirect_uri', redirectUrl);
    slackAuthUrl.searchParams.set('state', state);

    return res.redirect(302, slackAuthUrl.toString());
  } catch (error) {
    console.error('Slack install error:', error);
    return res.status(401).json({ error: 'Authentication required' });
  }
}
```

### 3. Slack OAuth Callback Endpoint

**File: `api/connections/slack/callback.ts`** (NEW)

```typescript
/**
 * GET /api/connections/slack/callback
 *
 * Handles the OAuth callback from Slack.
 * Exchanges the code for tokens and stores the connection.
 *
 * Flow:
 * 1. Verify state token (contains tenant_id)
 * 2. Exchange code for access token via Slack API
 * 3. Store connection in slack_connections table
 * 4. Redirect to dashboard connections page
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { createCipheriv, randomBytes } from 'crypto';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;
const STATE_SECRET = process.env.SLACK_STATE_SECRET || process.env.API_KEY_ENCRYPTION_KEY!;
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY!;

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pixelport-launchpad.vercel.app';

/**
 * Verify the signed state token.
 * Returns the tenant ID if valid, null otherwise.
 */
function verifyState(state: string): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;

  const [tenantId, timestamp, signature] = parts;

  // Check signature
  const payload = `${tenantId}.${timestamp}`;
  const expectedSig = createHmac('sha256', STATE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16);

  if (signature !== expectedSig) return null;

  // Check timestamp (valid for 10 minutes)
  const ts = parseInt(timestamp, 36);
  if (Date.now() - ts > 10 * 60 * 1000) return null;

  return tenantId;
}

/**
 * Encrypt a token for storage.
 */
function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error: slackError } = req.query as Record<string, string>;

  // Handle user cancellation
  if (slackError) {
    return res.redirect(302, `${DASHBOARD_URL}/dashboard/connections?error=${encodeURIComponent(slackError)}`);
  }

  if (!code || !state) {
    return res.redirect(302, `${DASHBOARD_URL}/dashboard/connections?error=missing_params`);
  }

  // 1. Verify state token
  const tenantId = verifyState(state);
  if (!tenantId) {
    return res.redirect(302, `${DASHBOARD_URL}/dashboard/connections?error=invalid_state`);
  }

  try {
    // 2. Exchange code for token
    const redirectUrl = process.env.SLACK_REDIRECT_URI
      || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/connections/slack/callback`;

    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUrl,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('Slack OAuth error:', tokenData.error);
      return res.redirect(302, `${DASHBOARD_URL}/dashboard/connections?error=slack_oauth_failed`);
    }

    // 3. Store connection
    const encryptedToken = encrypt(tokenData.access_token);

    const { error: upsertError } = await supabase
      .from('slack_connections')
      .upsert({
        tenant_id: tenantId,
        team_id: tokenData.team?.id,
        team_name: tokenData.team?.name,
        bot_token: encryptedToken,
        bot_user_id: tokenData.bot_user_id,
        installer_user_id: tokenData.authed_user?.id,
        scopes: tokenData.scope?.split(',') || [],
        is_active: true,
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id',
      });

    if (upsertError) {
      console.error('Slack connection save error:', upsertError);
      return res.redirect(302, `${DASHBOARD_URL}/dashboard/connections?error=save_failed`);
    }

    // 4. Redirect to connections page with success
    return res.redirect(302, `${DASHBOARD_URL}/dashboard/connections?slack=connected`);

  } catch (error) {
    console.error('Slack callback error:', error);
    return res.redirect(302, `${DASHBOARD_URL}/dashboard/connections?error=internal_error`);
  }
}
```

### 4. Connections Status Endpoint

**File: `api/connections/index.ts`** (NEW or REPLACE if exists)

```typescript
/**
 * GET /api/connections — Get status of all integrations
 *
 * Returns which integrations are connected for this tenant.
 * Used by the Connections page in the dashboard.
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

    // Check Slack connection
    const { data: slackConn } = await supabase
      .from('slack_connections')
      .select('id, team_id, team_name, is_active, connected_at, scopes')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    return res.status(200).json({
      integrations: {
        slack: slackConn ? {
          connected: slackConn.is_active,
          team_name: slackConn.team_name,
          team_id: slackConn.team_id,
          connected_at: slackConn.connected_at,
          scopes: slackConn.scopes,
        } : {
          connected: false,
        },
        email: {
          connected: !!tenant.agentmail_inbox,
          inbox: tenant.agentmail_inbox,
        },
        // Future integrations:
        // x: { connected: false },
        // linkedin: { connected: false },
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
```

### 5. Slack Events Webhook (Optional — for future use)

**File: `api/connections/slack/events.ts`** (NEW)

```typescript
/**
 * POST /api/connections/slack/events
 *
 * Receives events from Slack's Events API.
 * Handles:
 * - URL verification challenge (required for Slack setup)
 * - app_mention events → forward to tenant's OpenClaw agent
 * - message.im events → forward to tenant's OpenClaw agent
 *
 * NOTE: In production, per-tenant OpenClaw instances use Slack Socket Mode
 * directly (configured during provisioning). This webhook is a fallback
 * for centralized event routing if needed.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET!;

/**
 * Verify Slack request signature.
 */
function verifySlackSignature(req: VercelRequest, rawBody: string): boolean {
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const mySignature = 'v0=' + createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // Verify signature
  if (!verifySlackSignature(req, rawBody)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  // Handle URL verification (Slack sends this when you first set up the webhook URL)
  if (body.type === 'url_verification') {
    return res.status(200).json({ challenge: body.challenge });
  }

  // Handle events
  if (body.type === 'event_callback') {
    const event = body.event;

    // For now, acknowledge receipt. In production, per-tenant Socket Mode
    // handles events directly. This webhook is for future centralized routing.
    console.log(`Slack event: ${event.type} from team ${body.team_id}`);

    // TODO (Phase 2): Route events to tenant's OpenClaw agent
    // 1. Look up tenant by body.team_id in slack_connections
    // 2. Forward event to tenant's OpenClaw gateway
    // 3. Handle rate limiting and retries

    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true });
}
```

---

## Environment Variables Needed

Add these to Vercel:

```bash
# Slack App credentials (from founder)
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_SIGNING_SECRET=your-slack-signing-secret

# Optional — override redirect URI if needed
# SLACK_REDIRECT_URI=https://pixelport-launchpad.vercel.app/api/connections/slack/callback

# Already set (from Phase 0):
API_KEY_ENCRYPTION_KEY=...  # Reused for token encryption
SUPABASE_PROJECT_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## API Contract

### `GET /api/connections/slack/install`
Redirects user to Slack OAuth authorization page.

### `GET /api/connections/slack/callback`
Handles Slack OAuth callback. Redirects to:
- Success: `/dashboard/connections?slack=connected`
- Error: `/dashboard/connections?error=<error_code>`

### `GET /api/connections`
**Response:**
```json
{
  "integrations": {
    "slack": {
      "connected": true,
      "team_name": "Acme Corp",
      "team_id": "T123ABC",
      "connected_at": "2026-03-10T12:00:00Z",
      "scopes": ["channels:history", "chat:write", "..."]
    },
    "email": {
      "connected": true,
      "inbox": "acme@agentmail.to"
    }
  }
}
```

### `POST /api/connections/slack/events`
Slack Events API webhook. Returns `200 OK` for all valid events.

---

## Verification Checklist

### 1. TypeScript Compiles
```bash
npx tsc --noEmit api/connections/**/*.ts
```

### 2. Migration Applied
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'slack_connections';
```

### 3. OAuth Flow Structure
Verify the complete flow:
1. `GET /api/connections/slack/install` → redirects to `slack.com/oauth/v2/authorize`
2. User authorizes → Slack redirects to `GET /api/connections/slack/callback?code=...&state=...`
3. Callback exchanges code for token → stores in `slack_connections` → redirects to dashboard
4. `GET /api/connections` → shows Slack as connected

### 4. State Token Security
- State contains tenant_id + timestamp + HMAC signature
- Expires after 10 minutes
- Cannot be forged without STATE_SECRET

### 5. Token Encryption
- Bot token is encrypted with AES-256-CBC before storage
- Never returned in plaintext via API

### 6. Signature Verification
- Slack events webhook verifies `x-slack-signature` header
- Rejects requests older than 5 minutes
- Uses timing-safe comparison

### 7. No Secrets in Code
```bash
grep -r "xoxb-\|sk-\|eyJ" api/connections/
# Expected: no results
```

---

## Success Criteria

- [ ] Migration 005 creates `slack_connections` table
- [ ] `api/connections/slack/install.ts` redirects to Slack OAuth
- [ ] `api/connections/slack/callback.ts` exchanges code and stores connection
- [ ] `api/connections/index.ts` returns integration status
- [ ] `api/connections/slack/events.ts` handles URL verification + events
- [ ] Bot token encrypted at rest (AES-256-CBC)
- [ ] State token signed and time-limited
- [ ] Slack signature verification on events webhook
- [ ] All queries scoped by `tenant_id`
- [ ] TypeScript compiles without errors
- [ ] No hardcoded secrets

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`** — add session entry
2. **Update `docs/ACTIVE-PLAN.md`** — check off `1.C3`
3. **Feedback for CTO** — include:
   - Were Slack App credentials available? If not, what was mocked?
   - Any concerns about the OAuth state token approach?
   - Thoughts on Socket Mode vs Events API for per-tenant Slack integration
   - Did the `update_updated_at_column()` trigger function exist from previous migrations?
4. **Commit and push**

---

## Important Reminders

- **Do NOT touch Lovable frontend files** in `src/`
- **This slice is BLOCKED** until the founder creates a Slack App and shares credentials
- **Bot tokens must be encrypted** — never store `xoxb-*` tokens in plaintext
- **Slack signature verification** is mandatory for the events webhook
- **Socket Mode** is the primary integration method for per-tenant Slack (configured on the OpenClaw droplet). The centralized events webhook is a backup/future enhancement.
- **Redirect URI** must exactly match what's configured in the Slack App settings
- If Slack credentials aren't available yet, you can still:
  - Create the migration
  - Write all the endpoint code
  - Add placeholder env vars
  - Note in SESSION-LOG that testing requires credentials
