# Codex Slice 9 — Slack Activation via SSH Config Update

**Priority:** 🟡 Blocked until founder sets up Socket Mode (see Founder Tasks below)
**Assigned to:** Codex
**Depends on:** Slice 7 (Slack OAuth complete), Slice 4 (provisioned droplet exists)
**Estimated time:** 3-4 hours

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets an AI agent running on their own DigitalOcean droplet via OpenClaw.

**Where does this slice fit?** After a customer completes the Slack OAuth flow (Slice 7), their bot token is stored encrypted in our database — but the agent's OpenClaw instance on the droplet doesn't know about it yet. This slice bridges that gap:

1. Customer completes Slack OAuth → bot token stored in `slack_connections`
2. **This slice:** Inngest workflow SSHes into the droplet → injects Slack config → OpenClaw hot-reloads → bot comes alive in Slack

**Why SSH?** OpenClaw runs on isolated per-tenant droplets. There's no centralized API to update agent config. The config file at `/opt/openclaw/openclaw.json` needs to be updated directly on the droplet, and OpenClaw hot-reloads channel changes automatically (no restart needed).

**How this connects to other slices:**
- Slice 7 provides the OAuth callback that stores the bot token
- Slice 4 provisions the droplet with SSH keys already included
- After this slice, the customer's Chief of Staff is alive and responding in Slack

---

## Repository Access

- **Repo:** https://github.com/Analog-Labs/pixelport-launchpad
- **Branch:** Work on `main`
- Read `CLAUDE.md` first, then `docs/phase1/cto-phase1-go-package-v2.md` for critical Vercel patterns
- After completing work: update SESSION-LOG.md, commit and push

---

## ⚠️ CRITICAL: Vercel Serverless Patterns

1. **Inngest Client — INLINE ONLY.** Do NOT import from `../inngest/client` or any local file:
   ```typescript
   // ✅ CORRECT
   import { Inngest } from 'inngest';
   const inngest = new Inngest({ id: 'pixelport', eventKey: process.env.INNGEST_EVENT_KEY });

   // ❌ WRONG — crashes Vercel
   import { inngest } from '../inngest/client';
   ```
2. **ESM/CJS:** `api/package.json` has `{"type": "commonjs"}`. Do NOT delete.
3. **After deploy:** Sync Inngest with `curl -X PUT https://pixelport-launchpad.vercel.app/api/inngest`

---

## What You're Building

### 1. Slack Activation Inngest Workflow

**File: `api/inngest/functions/activate-slack.ts`** (NEW)

This is a durable Inngest workflow triggered when a customer completes Slack OAuth. It SSH's into the customer's droplet and updates the OpenClaw config to include Slack channel settings.

```typescript
/**
 * Inngest function: activate-slack
 *
 * Triggered by: pixelport/slack.connected
 * Purpose: SSH into tenant's droplet, update OpenClaw config with Slack channel,
 *          OpenClaw hot-reloads, bot comes alive in Slack.
 *
 * Prerequisites:
 * - Tenant must have an active droplet (status: 'active', droplet_ip set)
 * - slack_connections row must exist with encrypted bot_token
 * - SSH_PRIVATE_KEY env var must be set
 * - SLACK_APP_TOKEN env var must be set (app-level token for Socket Mode)
 */
import { Inngest } from 'inngest';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';
import { Client as SSHClient } from 'ssh2';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY!;
const SSH_PRIVATE_KEY = process.env.SSH_PRIVATE_KEY!;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN!;
const CONFIG_PATH = '/opt/openclaw/openclaw.json';

/**
 * Decrypt a bot token stored by the OAuth callback.
 * Format: iv_hex:encrypted_hex (AES-256-CBC)
 */
function decryptToken(encrypted: string): string {
  const [ivHex, encryptedHex] = encrypted.split(':');
  if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted token format');

  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Execute a command on a remote host via SSH.
 * Returns stdout as a string.
 */
function sshExec(host: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH connection timeout (30s)'));
    }, 30_000);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (data: Buffer) => { stdout += data.toString(); });
        stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          conn.end();
          if (code !== 0) {
            reject(new Error(`SSH command failed (code ${code}): ${stderr}`));
          } else {
            resolve(stdout);
          }
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    conn.connect({
      host,
      port: 22,
      username: 'root',
      privateKey: SSH_PRIVATE_KEY,
      readyTimeout: 15_000,
    });
  });
}

export const activateSlack = inngest.createFunction(
  {
    id: 'activate-slack',
    name: 'Activate Slack on Tenant Droplet',
    retries: 2,
  },
  { event: 'pixelport/slack.connected' },
  async ({ event, step }) => {
    const { tenantId } = event.data;

    // Step 1: Load tenant and slack connection
    const { tenant, slackConn } = await step.run('load-tenant-and-slack', async () => {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, slug, droplet_ip, status')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      if (!tenant.droplet_ip) {
        throw new Error(`Tenant ${tenant.slug} has no droplet IP — not yet provisioned`);
      }

      const { data: slackConn, error: slackError } = await supabase
        .from('slack_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (slackError || !slackConn) {
        throw new Error(`No Slack connection found for tenant ${tenantId}`);
      }

      return { tenant, slackConn };
    });

    // Step 2: Decrypt bot token
    const botToken = await step.run('decrypt-bot-token', async () => {
      return decryptToken(slackConn.bot_token);
    });

    // Step 3: SSH into droplet and update OpenClaw config
    await step.run('ssh-update-config', async () => {
      if (!SSH_PRIVATE_KEY) throw new Error('SSH_PRIVATE_KEY env var not set');
      if (!SLACK_APP_TOKEN) throw new Error('SLACK_APP_TOKEN env var not set');

      // Build the Slack channel config
      const slackChannelConfig = {
        enabled: true,
        botToken: botToken,
        appToken: '${SLACK_APP_TOKEN}', // OpenClaw env var substitution
        dmPolicy: 'open',
        allowFrom: ['*'],
        actions: {
          Messages: true,
          DM: true,
          Reactions: true,
          Pins: true,
          MemberInfo: true,
          EmojiList: true,
          ChannelInfo: true,
        },
        replyToMode: 'first',
        allowBotMessages: true,
        configWrites: true,
      };

      // Read current config, merge slack channel, write back
      // Use a single SSH command to read, merge with jq, and write atomically
      const mergeScript = `
        set -euo pipefail
        CONFIG="${CONFIG_PATH}"
        BACKUP="${CONFIG_PATH}.bak-$(date +%s)"

        # Backup current config
        cp "$CONFIG" "$BACKUP"

        # Read current config
        CURRENT=$(cat "$CONFIG")

        # Write the slack channel config to a temp file
        cat > /tmp/slack-channel.json << 'SLACK_JSON'
${JSON.stringify(slackChannelConfig, null, 2)}
SLACK_JSON

        # Merge using Node.js (available on the droplet)
        node -e "
          const fs = require('fs');
          const current = JSON.parse(fs.readFileSync('${CONFIG_PATH}', 'utf8'));
          const slack = JSON.parse(fs.readFileSync('/tmp/slack-channel.json', 'utf8'));

          // Merge channels.slack into existing config
          if (!current.channels) current.channels = {};
          current.channels.slack = slack;

          fs.writeFileSync('${CONFIG_PATH}', JSON.stringify(current, null, 2));
          console.log('Config updated successfully');
        "

        # Clean up temp file
        rm -f /tmp/slack-channel.json

        # Set ownership (OpenClaw runs as node:1000)
        chown 1000:1000 "$CONFIG"

        echo "Slack channel activated. Config hot-reload should pick it up."
      `.trim();

      const result = await sshExec(tenant.droplet_ip!, mergeScript);
      return { output: result };
    });

    // Step 4: Wait for hot-reload
    await step.sleep('wait-for-hot-reload', '15s');

    // Step 5: Verify gateway is still healthy
    await step.run('verify-gateway', async () => {
      try {
        const response = await fetch(`http://${tenant.droplet_ip}:18789/`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) {
          throw new Error(`Gateway returned HTTP ${response.status}`);
        }
        return { healthy: true };
      } catch (error) {
        // Non-fatal — hot-reload might need more time
        console.warn('Gateway health check after Slack activation:', error);
        return { healthy: false, warning: 'Gateway may still be reloading' };
      }
    });

    // Step 6: Mark Slack connection as fully active
    await step.run('mark-slack-active', async () => {
      await supabase
        .from('slack_connections')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);

      return { activated: true };
    });

    return {
      success: true,
      tenantId,
      dropletIp: tenant.droplet_ip,
      teamId: slackConn.team_id,
    };
  },
);
```

### 2. Register the Function with Inngest Serve

**File: `api/inngest/index.ts`** (MODIFY)

Add the `activateSlack` function to the Inngest serve endpoint.

**Current file looks like:**
```typescript
import { serve } from 'inngest/express';
import { Inngest } from 'inngest';
import { provisionTenant } from './functions/provision-tenant';

const inngest = new Inngest({ ... });

export default serve({
  client: inngest,
  functions: [provisionTenant],
});
```

**Change to:**
```typescript
import { serve } from 'inngest/express';
import { Inngest } from 'inngest';
import { provisionTenant } from './functions/provision-tenant';
import { activateSlack } from './functions/activate-slack';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export default serve({
  client: inngest,
  functions: [provisionTenant, activateSlack],
});
```

### 3. Fire Inngest Event from OAuth Callback

**File: `api/connections/slack/callback.ts`** (MODIFY)

After the successful upsert of the Slack connection (around line 180), fire the Inngest event to trigger the activation workflow.

**Add these imports at the top:**
```typescript
import { Inngest } from 'inngest';
```

**Add inline Inngest client after imports:**
```typescript
// Inline client — do NOT import from local file (crashes Vercel esbuild)
const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

**After the successful upsert (after `if (upsertError) { ... }` block), add:**
```typescript
    // Trigger Slack activation on the tenant's droplet
    try {
      await inngest.send({
        name: 'pixelport/slack.connected',
        data: { tenantId },
      });
    } catch (inngestError) {
      // Non-fatal — activation can be retried manually
      console.error('Failed to send slack.connected event:', inngestError);
    }
```

### 4. Add SLACK_APP_TOKEN to Provisioning Cloud-Init

**File: `api/inngest/functions/provision-tenant.ts`** (MODIFY)

In the `buildCloudInit` function, find the `.env` file creation section (step 6 in cloud-init). Add `SLACK_APP_TOKEN`:

**Find:**
```
cat > /opt/openclaw/.env << 'ENV_FILE'
OPENAI_API_KEY=${params.litellmKey}
OPENAI_BASE_URL=${params.litellmUrl}/v1
AGENTMAIL_API_KEY=${params.agentmailApiKey}
ENV_FILE
```

**Replace with:**
```
cat > /opt/openclaw/.env << 'ENV_FILE'
OPENAI_API_KEY=${params.litellmKey}
OPENAI_BASE_URL=${params.litellmUrl}/v1
AGENTMAIL_API_KEY=${params.agentmailApiKey}
SLACK_APP_TOKEN=${process.env.SLACK_APP_TOKEN || ''}
ENV_FILE
```

### 5. Add ssh2 Dependency

**Run:**
```bash
npm install ssh2
npm install --save-dev @types/ssh2
```

Or add to `package.json` dependencies:
```json
{
  "ssh2": "^1.16.0"
}
```

---

## Environment Variables

### Already Set
| Variable | Status |
|----------|--------|
| SUPABASE_PROJECT_URL | ✅ SET |
| SUPABASE_SERVICE_ROLE_KEY | ✅ SET |
| API_KEY_ENCRYPTION_KEY | ✅ SET |
| INNGEST_EVENT_KEY | ✅ SET |
| INNGEST_SIGNING_KEY | ✅ SET |

### NEW — Must Be Set Before Testing
| Variable | Source | Notes |
|----------|--------|-------|
| SLACK_APP_TOKEN | Slack App > Socket Mode > App-Level Token | `xapp-...` format |
| SSH_PRIVATE_KEY | Generated by CTO | Full PEM content (not a file path) |

**⚠️ Do NOT commit or log these values.** They will be provided as Vercel env vars.

---

## Verification Checklist

### 1. TypeScript Compiles
```bash
npx tsc --noEmit api/inngest/functions/activate-slack.ts
```

### 2. Inngest Function Registered
After deploy + sync (`curl -X PUT .../api/inngest`), check Inngest Cloud dashboard for the `activate-slack` function.

### 3. Callback Fires Event
Verify `api/connections/slack/callback.ts` includes the `inngest.send()` call after successful upsert.

### 4. No Hardcoded Secrets
```bash
grep -r "xoxb-\|xapp-\|sk-\|eyJ\|BEGIN.*PRIVATE" api/inngest/functions/activate-slack.ts api/connections/slack/callback.ts
# Expected: no results
```

### 5. SSH Script Safety
- Config backup created before modification
- `chown 1000:1000` preserves OpenClaw's node user ownership
- Temp files cleaned up
- Atomic write via Node.js on the droplet

### 6. No Local Inngest Imports
```bash
grep -r "from.*inngest/client" api/connections/slack/callback.ts api/inngest/functions/activate-slack.ts
# Expected: no results
```

---

## Success Criteria

- [ ] `api/inngest/functions/activate-slack.ts` created
- [ ] TypeScript compiles without errors
- [ ] `activateSlack` registered in `api/inngest/index.ts`
- [ ] `api/connections/slack/callback.ts` fires `pixelport/slack.connected` event
- [ ] `provision-tenant.ts` includes `SLACK_APP_TOKEN` in cloud-init `.env`
- [ ] `ssh2` added to package.json dependencies
- [ ] Config backup created before modification
- [ ] Inline Inngest client used (not imported from local file)
- [ ] No hardcoded secrets
- [ ] Error handling: tenant not found, no droplet IP, SSH timeout, config parse failure

---

## Founder Tasks (Required Before Testing)

1. **Enable Socket Mode** in Slack App ("Pixel") settings at api.slack.com/apps
2. **Create App-Level Token** with scope `connections:write` → generates `xapp-...` token
3. **Add `SLACK_APP_TOKEN`** to Vercel env vars
4. **Configure Event Subscriptions** URL → `https://pixelport-launchpad.vercel.app/api/connections/slack/events`
5. **Subscribe to bot events:** `message.channels`, `message.im`, `app_mention`
6. **CTO will provide** `SSH_PRIVATE_KEY` for Vercel env vars

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`**
2. **Commit and push** — Vercel auto-deploys
3. **After deploy:** `curl -X PUT https://pixelport-launchpad.vercel.app/api/inngest`
4. **Feedback for CTO:** Did the ssh2 import work in Vercel? Any issues with the config merge script? Observations about the activation flow?

---

## Important Reminders

- **Do NOT touch Lovable frontend files** in `src/`
- **Inngest client MUST be inline** — importing from local files crashes Vercel
- **OpenClaw config hot-reloads** for channel changes — no restart needed
- **The appToken (`xapp-...`)** is per-app, not per-workspace. It's the same for all tenants.
- **The botToken (`xoxb-...`)** is per-workspace, from the OAuth callback. It's encrypted in the DB.
- **SSH keys** are already included in droplet creation (provisioning queries DO account keys)
- **Config backup** is mandatory before any modification
