import { Inngest } from 'inngest';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';
import { reconcileBootstrapState } from '../../lib/bootstrap-state';
import { sshExec } from '../../lib/droplet-ssh';
import {
  buildSlackConfig,
  buildSlackWelcomeMessage,
  isSlackConfigCurrent,
  parseSlackConfigState,
  runtimeLogsSuggestSlackReady,
} from '../../lib/slack-activation';
import { deriveSlackConnection } from '../../lib/slack-connection';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY_ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;
const SSH_PRIVATE_KEY = process.env.SSH_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;
const BOOTSTRAP_READY_MAX_ATTEMPTS = 20;
const BOOTSTRAP_READY_WAIT = '30s';
const GATEWAY_HEALTH_MAX_ATTEMPTS = 6;
const GATEWAY_HEALTH_WAIT = '10s';

type EventData = { tenantId?: string };
type JsonRecord = Record<string, unknown>;

type TenantRow = {
  id: string;
  slug: string;
  status: string;
  droplet_ip: string | null;
  onboarding_data: JsonRecord | null;
};

type SlackConnectionRow = {
  tenant_id: string;
  team_id: string;
  team_name: string | null;
  bot_token: string;
  is_active: boolean;
  scopes: string[] | null;
  installer_user_id: string | null;
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

function getAgentName(onboardingData: JsonRecord | null | undefined): string {
  const value = onboardingData?.agent_name;
  return typeof value === 'string' && value.trim() ? value.trim() : 'your Chief';
}

function buildConfigPatchScript(botToken: string): string {
  const slackConfig = buildSlackConfig(botToken);
  // Use python3 — it's always available on Ubuntu 24.04 droplets.
  // Node.js is NOT installed on the host (only inside the Docker container).
  return `
set -euo pipefail
CONFIG="/opt/openclaw/openclaw.json"
BACKUP="$CONFIG.bak-$(date +%s)"

cp "$CONFIG" "$BACKUP"

cat > /tmp/pixelport-slack.json << 'SLACK_JSON'
${slackConfig}
SLACK_JSON

python3 << 'PYEOF'
import json, os
config_path = "/opt/openclaw/openclaw.json"
tmp_path = "/tmp/openclaw.json.tmp"
with open(config_path) as f:
    current = json.load(f)
with open("/tmp/pixelport-slack.json") as f:
    slack = json.load(f)
if "channels" not in current:
    current["channels"] = {}
current["channels"]["slack"] = slack
with open(tmp_path, "w") as f:
    json.dump(current, f, indent=2)
os.rename(tmp_path, config_path)
PYEOF

rm -f /tmp/pixelport-slack.json
chown 1000:1000 "$CONFIG"
echo "SLACK_CONFIG_UPDATED"
`.trim();
}

function buildConfigCheckScript(botToken: string): string {
  return `
set -euo pipefail
python3 << 'PYEOF'
import json
config = json.load(open('/opt/openclaw/openclaw.json'))
slack = config.get('channels', {}).get('slack', {})
print(json.dumps({
    'enabled': slack.get('enabled') is True,
    'botTokenPresent': isinstance(slack.get('botToken', ''), str) and len(slack.get('botToken', '')) > 0,
    'botTokenMatches': slack.get('botToken') == ${JSON.stringify(botToken)},
    'appTokenMatches': slack.get('appToken') == '${'${SLACK_APP_TOKEN}'}',
    'dmPolicy': slack.get('dmPolicy'),
    'groupPolicy': slack.get('groupPolicy'),
    'allowFromAll': slack.get('allowFrom') == ['*'],
    'replyToMode': slack.get('replyToMode'),
    'configWrites': slack.get('configWrites'),
}))
PYEOF
`.trim();
}

function buildRuntimeLogProbeScript(since: string): string {
  return `
set -euo pipefail
docker logs openclaw-gateway --since ${JSON.stringify(since)} 2>&1 | tail -n 120 || true
`.trim();
}

const RESTART_GATEWAY_SCRIPT = `
set -euo pipefail
docker restart openclaw-gateway >/dev/null
docker inspect -f '{{.State.Running}}' openclaw-gateway
`.trim();

async function verifyGatewayHealth(host: string): Promise<{ healthy: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(`http://${host}:18789/`, {
      signal: AbortSignal.timeout(5000),
    });
    return { healthy: response.ok, status: response.status };
  } catch (error) {
    return { healthy: false, error: error instanceof Error ? error.message : 'Gateway check failed' };
  }
}

async function postSlackWelcomeMessage(params: {
  botToken: string;
  installerUserId: string;
  agentName: string;
}): Promise<{ sent: boolean; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel: params.installerUserId,
      text: buildSlackWelcomeMessage(params.agentName),
    }),
  });

  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    return {
      sent: false,
      error: payload.error ?? `HTTP ${response.status}`,
    };
  }

  return { sent: true };
}

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

    const { tenant, slackConn } = await step.run(
      'load-tenant-and-slack',
      async (): Promise<{ tenant: TenantRow; slackConn: SlackConnectionRow }> => {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('id, slug, status, droplet_ip, onboarding_data')
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
          .select('tenant_id, team_id, team_name, bot_token, is_active, scopes, installer_user_id')
          .eq('tenant_id', tenantId)
          .single();

        if (slackError || !slackData) {
          throw new Error(`Slack connection not found for tenant ${tenantId}`);
        }

        return {
          tenant: tenantData as TenantRow,
          slackConn: slackData as SlackConnectionRow,
        };
      }
    );

    if (!SLACK_APP_TOKEN) {
      throw new Error('SLACK_APP_TOKEN env var is not set');
    }
    if (!SSH_PRIVATE_KEY) {
      throw new Error('SSH_PRIVATE_KEY env var is not set');
    }

    const botToken = await step.run('decrypt-bot-token', async () => decryptToken(slackConn.bot_token));
    const slackState = deriveSlackConnection(slackConn);

    if (slackState.reauthorization_required) {
      throw new Error(
        `Slack connection for tenant ${tenant.slug} is missing required scopes: ${slackState.missing_scopes.join(', ')}`
      );
    }

    let bootstrapReady = false;
    for (let attempt = 0; attempt < BOOTSTRAP_READY_MAX_ATTEMPTS; attempt += 1) {
      const bootstrap = await step.run(`check-bootstrap-ready-${attempt + 1}`, async () => {
        const state = await reconcileBootstrapState({
          tenantId,
          fallbackOnboardingData: tenant.onboarding_data,
        });
        return state.effectiveState;
      });

      if (bootstrap.status === 'completed') {
        bootstrapReady = true;
        break;
      }

      if (bootstrap.status === 'failed') {
        throw new Error(`Tenant ${tenant.slug} bootstrap is not ready for Slack activation: ${bootstrap.last_error}`);
      }

      if (attempt < BOOTSTRAP_READY_MAX_ATTEMPTS - 1) {
        await step.sleep(`wait-for-bootstrap-ready-${attempt + 1}`, BOOTSTRAP_READY_WAIT);
      }
    }

    if (!bootstrapReady) {
      throw new Error(`Tenant ${tenant.slug} did not reach truthful bootstrap completion before Slack activation timeout.`);
    }

    const existingConfig = await step.run('check-existing-config', async () => {
      const output = await sshExec(tenant.droplet_ip!, buildConfigCheckScript(botToken));
      const state = parseSlackConfigState(output);
      return {
        state,
        alreadyConfigured: isSlackConfigCurrent(state),
      };
    });

    if (!existingConfig.alreadyConfigured) {
      const configPatchedAt = new Date().toISOString();

      await step.run('ssh-update-config', async () => {
        const output = await sshExec(tenant.droplet_ip!, buildConfigPatchScript(botToken));
        return { output };
      });
      await step.sleep('wait-hot-reload', '15s');

      const verifiedConfig = await step.run('verify-config-after-patch', async () => {
        const output = await sshExec(tenant.droplet_ip!, buildConfigCheckScript(botToken));
        const state = parseSlackConfigState(output);
        return {
          state,
          current: isSlackConfigCurrent(state),
        };
      });

      if (!verifiedConfig.current) {
        throw new Error(`Slack config patch did not persist correctly for tenant ${tenant.slug}.`);
      }

      const hotReloadLogs = await step.run('probe-hot-reload-logs', async () => {
        return await sshExec(tenant.droplet_ip!, buildRuntimeLogProbeScript(configPatchedAt));
      });

      if (!runtimeLogsSuggestSlackReady(hotReloadLogs)) {
        await step.run('restart-openclaw-gateway', async () => {
          const output = await sshExec(tenant.droplet_ip!, RESTART_GATEWAY_SCRIPT);
          return { output };
        });
      }
    }

    let gatewayHealth: { healthy: boolean; status?: number; error?: string } = { healthy: false };
    for (let attempt = 0; attempt < GATEWAY_HEALTH_MAX_ATTEMPTS; attempt += 1) {
      gatewayHealth = await step.run(
        `verify-gateway-health-${attempt + 1}`,
        async (): Promise<{ healthy: boolean; status?: number; error?: string }> => {
          return await verifyGatewayHealth(tenant.droplet_ip!);
        }
      );

      if (gatewayHealth.healthy) {
        break;
      }

      if (attempt < GATEWAY_HEALTH_MAX_ATTEMPTS - 1) {
        await step.sleep(`wait-for-gateway-health-${attempt + 1}`, GATEWAY_HEALTH_WAIT);
      }
    }

    if (!gatewayHealth.healthy) {
      throw new Error(`Gateway unhealthy on ${tenant.droplet_ip} (status: ${gatewayHealth.status ?? 'unreachable'}).`);
    }

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

    const welcomeDm = await step.run('send-slack-welcome-dm', async () => {
      if (!slackConn.installer_user_id) {
        return {
          sent: false,
          skipped: true,
          reason: 'missing_installer_user_id',
        };
      }

      try {
        const result = await postSlackWelcomeMessage({
          botToken,
          installerUserId: slackConn.installer_user_id,
          agentName: getAgentName(tenant.onboarding_data),
        });

        if (!result.sent) {
          console.error('Slack welcome DM failed', {
            tenantId,
            error: result.error,
          });
        }

        return {
          sent: result.sent,
          skipped: false,
          error: result.error,
        };
      } catch (error) {
        console.error('Slack welcome DM threw', {
          tenantId,
          error,
        });

        return {
          sent: false,
          skipped: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    return {
      success: true,
      tenantId,
      teamId: slackConn.team_id,
      dropletIp: tenant.droplet_ip,
      alreadyConfigured: existingConfig.alreadyConfigured,
      welcomeDm,
    };
  }
);
