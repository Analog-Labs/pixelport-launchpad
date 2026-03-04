import { Inngest } from 'inngest';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';
import { Client as SSHClient } from 'ssh2';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY_ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;
// Vercel may store multiline env vars with literal \n — restore real newlines
const SSH_PRIVATE_KEY = process.env.SSH_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;

type EventData = { tenantId?: string };

type TenantRow = {
  id: string;
  slug: string;
  status: string;
  droplet_ip: string | null;
};

type SlackConnectionRow = {
  tenant_id: string;
  team_id: string;
  bot_token: string;
  is_active: boolean;
};

function getSupabaseClient() {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function decryptToken(encrypted: string): string {
  if (!API_KEY_ENCRYPTION_KEY || API_KEY_ENCRYPTION_KEY.length !== 64) {
    throw new Error('API_KEY_ENCRYPTION_KEY must be a 64-char hex string');
  }

  const [ivHex, encryptedHex] = encrypted.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(API_KEY_ENCRYPTION_KEY, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function sshExec(host: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SSH_PRIVATE_KEY) {
      reject(new Error('SSH_PRIVATE_KEY env var is not set'));
      return;
    }

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
        stream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          conn.end();
          if (code !== 0) {
            reject(new Error(`SSH command failed (code ${code}): ${stderr.trim()}`));
            return;
          }
          resolve(stdout);
        });
      });
    });

    conn.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
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

function buildSlackConfig(botToken: string): string {
  return JSON.stringify(
    {
      enabled: true,
      botToken,
      appToken: '${SLACK_APP_TOKEN}',
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
    },
    null,
    2
  );
}

function buildConfigPatchScript(botToken: string): string {
  const slackConfig = buildSlackConfig(botToken);
  return `
set -euo pipefail
CONFIG="/opt/openclaw/openclaw.json"
BACKUP="$CONFIG.bak-$(date +%s)"

cp "$CONFIG" "$BACKUP"

cat > /tmp/pixelport-slack.json << 'SLACK_JSON'
${slackConfig}
SLACK_JSON

node - <<'NODE'
const fs = require('fs');
const configPath = '/opt/openclaw/openclaw.json';
const tmpPath = '/tmp/openclaw.json.tmp';
const current = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const slack = JSON.parse(fs.readFileSync('/tmp/pixelport-slack.json', 'utf8'));

if (!current.channels) current.channels = {};
current.channels.slack = slack;

fs.writeFileSync(tmpPath, JSON.stringify(current, null, 2));
fs.renameSync(tmpPath, configPath);
NODE

rm -f /tmp/pixelport-slack.json /tmp/openclaw.json.tmp
chown 1000:1000 "$CONFIG"
echo "SLACK_CONFIG_UPDATED"
`.trim();
}

const CONFIG_CHECK_SCRIPT = `
set -euo pipefail
node - <<'NODE'
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('/opt/openclaw/openclaw.json', 'utf8'));
const slack = config.channels && config.channels.slack;
if (slack && slack.enabled === true && typeof slack.botToken === 'string' && slack.botToken.length > 0) {
  process.stdout.write('ACTIVE');
} else {
  process.stdout.write('MISSING');
}
NODE
`.trim();

export const activateSlack = inngest.createFunction(
  {
    id: 'activate-slack',
    name: 'Activate Slack on tenant droplet',
    retries: 2,
  },
  { event: 'pixelport/slack.connected' },
  async ({ event, step }) => {
    const { tenantId } = (event.data || {}) as EventData;
    if (!tenantId) {
      throw new Error('Missing tenantId in event payload');
    }

    const supabase = getSupabaseClient();

    const { tenant, slackConn } = await step.run('load-tenant-and-slack', async () => {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, slug, status, droplet_ip')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenantData) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      if (!tenantData.droplet_ip) {
        throw new Error(`Tenant ${tenantData.slug} has no droplet_ip`);
      }

      const { data: slackData, error: slackError } = await supabase
        .from('slack_connections')
        .select('tenant_id, team_id, bot_token, is_active')
        .eq('tenant_id', tenantId)
        .single();

      if (slackError || !slackData) {
        throw new Error(`Slack connection not found for tenant ${tenantId}`);
      }

      return {
        tenant: tenantData as TenantRow,
        slackConn: slackData as SlackConnectionRow,
      };
    });

    if (!SLACK_APP_TOKEN) {
      throw new Error('SLACK_APP_TOKEN env var is not set');
    }
    if (!SSH_PRIVATE_KEY) {
      throw new Error('SSH_PRIVATE_KEY env var is not set');
    }

    const botToken = await step.run('decrypt-bot-token', async () => decryptToken(slackConn.bot_token));

    const existingConfig = await step.run('check-existing-config', async () => {
      if (!slackConn.is_active) return { alreadyConfigured: false };
      try {
        const output = await sshExec(tenant.droplet_ip!, CONFIG_CHECK_SCRIPT);
        return { alreadyConfigured: output.includes('ACTIVE') };
      } catch {
        return { alreadyConfigured: false };
      }
    });

    if (!existingConfig.alreadyConfigured) {
      await step.run('ssh-update-config', async () => {
        const output = await sshExec(tenant.droplet_ip!, buildConfigPatchScript(botToken));
        return { output };
      });
      await step.sleep('wait-hot-reload', '15s');
    }

    await step.run('verify-gateway-health', async () => {
      try {
        const response = await fetch(`http://${tenant.droplet_ip}:18789/`, {
          signal: AbortSignal.timeout(5000),
        });
        return { healthy: response.ok, status: response.status };
      } catch (error) {
        return { healthy: false, warning: error instanceof Error ? error.message : 'Gateway check failed' };
      }
    });

    await step.run('mark-slack-active', async () => {
      const { error } = await supabase
        .from('slack_connections')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      if (error) {
        throw new Error(`Failed to mark slack active: ${error.message}`);
      }

      return { activated: true };
    });

    return {
      success: true,
      tenantId,
      teamId: slackConn.team_id,
      dropletIp: tenant.droplet_ip,
      alreadyConfigured: existingConfig.alreadyConfigured,
    };
  }
);
