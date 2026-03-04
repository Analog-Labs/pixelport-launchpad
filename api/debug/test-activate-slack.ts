import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';

/**
 * POST /api/debug/test-activate-slack?tenantId=...
 *
 * Replicates activate-slack steps with detailed error reporting.
 * NOT for production — remove after debugging.
 */

function decrypt(encrypted: string): string {
  const key = process.env.API_KEY_ENCRYPTION_KEY;
  if (!key || key.length !== 64) throw new Error('Bad encryption key');
  const [ivHex, encHex] = encrypted.split(':');
  if (!ivHex || !encHex) throw new Error('Invalid encrypted format');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(ivHex, 'hex'));
  return decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
  if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });

  const steps: Array<{ step: string; status: string; detail?: string }> = [];

  // Step 1: Check env vars
  // Vercel may store multiline env vars with literal \n — restore real newlines
  const sshKey = process.env.SSH_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const appToken = process.env.SLACK_APP_TOKEN;
  steps.push({
    step: 'env-check',
    status: sshKey ? 'OK' : 'FAIL',
    detail: `SSH_PRIVATE_KEY: ${sshKey ? `${sshKey.length} chars, starts with "${sshKey.substring(0, 30)}..."` : 'MISSING'}`,
  });
  steps.push({
    step: 'env-check-apptoken',
    status: appToken ? 'OK' : 'FAIL',
    detail: `SLACK_APP_TOKEN: ${appToken ? `${appToken.substring(0, 10)}...` : 'MISSING'}`,
  });

  if (!sshKey || !appToken) {
    return res.status(200).json({ steps, conclusion: 'Missing env vars' });
  }

  // Step 2: Load tenant + slack data
  const url = process.env.SUPABASE_PROJECT_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    steps.push({ step: 'supabase', status: 'FAIL', detail: 'Missing Supabase config' });
    return res.status(200).json({ steps });
  }

  const supabase = createClient(url, serviceKey);

  let dropletIp = '';
  let encryptedToken = '';

  try {
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, slug, droplet_ip')
      .eq('id', tenantId)
      .single();

    if (tErr || !tenant) throw new Error(`Tenant error: ${tErr?.message || 'not found'}`);
    dropletIp = tenant.droplet_ip || '';
    steps.push({ step: 'load-tenant', status: 'OK', detail: `slug=${tenant.slug}, ip=${dropletIp}` });
  } catch (e) {
    steps.push({ step: 'load-tenant', status: 'FAIL', detail: (e as Error).message });
    return res.status(200).json({ steps });
  }

  try {
    const { data: slack, error: sErr } = await supabase
      .from('slack_connections')
      .select('tenant_id, team_id, bot_token, is_active')
      .eq('tenant_id', tenantId)
      .single();

    if (sErr || !slack) throw new Error(`Slack error: ${sErr?.message || 'not found'}`);
    encryptedToken = slack.bot_token;
    steps.push({ step: 'load-slack', status: 'OK', detail: `team=${slack.team_id}, active=${slack.is_active}` });
  } catch (e) {
    steps.push({ step: 'load-slack', status: 'FAIL', detail: (e as Error).message });
    return res.status(200).json({ steps });
  }

  // Step 3: Decrypt token
  let botToken = '';
  try {
    botToken = decrypt(encryptedToken);
    steps.push({ step: 'decrypt', status: 'OK', detail: `Token starts with ${botToken.substring(0, 10)}..., length=${botToken.length}` });
  } catch (e) {
    steps.push({ step: 'decrypt', status: 'FAIL', detail: (e as Error).message });
    return res.status(200).json({ steps });
  }

  // Step 4: Test SSH connection
  try {
    const { Client } = await import('ssh2');
    steps.push({ step: 'ssh2-import', status: 'OK', detail: 'ssh2 module loaded' });

    const sshResult = await new Promise<string>((resolve, reject) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH timeout (15s)'));
      }, 15_000);

      conn.on('ready', () => {
        conn.exec('echo SSH_OK && cat /opt/openclaw/openclaw.json | python3 -c "import sys,json; c=json.load(sys.stdin); print(\"HAS_CHANNELS\" if c.get(\"channels\") else \"NO_CHANNELS\")"', (err, stream) => {
          if (err) { clearTimeout(timeout); conn.end(); reject(err); return; }
          let out = '';
          let errOut = '';
          stream.on('data', (d: Buffer) => { out += d.toString(); });
          stream.stderr.on('data', (d: Buffer) => { errOut += d.toString(); });
          stream.on('close', () => {
            clearTimeout(timeout);
            conn.end();
            resolve(out.trim() + (errOut ? `\nSTDERR: ${errOut.trim()}` : ''));
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      conn.connect({
        host: dropletIp,
        port: 22,
        username: 'root',
        privateKey: sshKey,
        readyTimeout: 10_000,
      });
    });

    steps.push({ step: 'ssh-test', status: 'OK', detail: sshResult });
  } catch (e) {
    steps.push({ step: 'ssh-test', status: 'FAIL', detail: (e as Error).message });
    return res.status(200).json({ steps, conclusion: 'SSH failed — check key format' });
  }

  // Step 5: Actually inject the Slack config
  try {
    const { Client } = await import('ssh2');

    // OpenClaw 2026.2.24 validated schema — no capitalized action keys or allowBotMessages
    const slackConfig = JSON.stringify({
      enabled: true,
      botToken,
      appToken: '${SLACK_APP_TOKEN}',
      dmPolicy: 'open',
      allowFrom: ['*'],
      replyToMode: 'first',
      configWrites: true,
    }, null, 2);

    // Use python3 — node is not installed on the host
    const script = `
set -euo pipefail
CONFIG="/opt/openclaw/openclaw.json"
cp "$CONFIG" "$CONFIG.bak-$(date +%s)"

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

    const result = await new Promise<string>((resolve, reject) => {
      const conn = new Client();
      const timeout = setTimeout(() => { conn.end(); reject(new Error('SSH timeout (30s)')); }, 30_000);

      conn.on('ready', () => {
        conn.exec(script, (err, stream) => {
          if (err) { clearTimeout(timeout); conn.end(); reject(err); return; }
          let out = '';
          let errOut = '';
          stream.on('data', (d: Buffer) => { out += d.toString(); });
          stream.stderr.on('data', (d: Buffer) => { errOut += d.toString(); });
          stream.on('close', (code: number) => {
            clearTimeout(timeout);
            conn.end();
            if (code !== 0) reject(new Error(`Exit ${code}: ${errOut.trim()}`));
            else resolve(out.trim());
          });
        });
      });

      conn.on('error', (err) => { clearTimeout(timeout); reject(err); });

      conn.connect({
        host: dropletIp,
        port: 22,
        username: 'root',
        privateKey: sshKey,
        readyTimeout: 10_000,
      });
    });

    steps.push({ step: 'inject-config', status: 'OK', detail: result });
  } catch (e) {
    steps.push({ step: 'inject-config', status: 'FAIL', detail: (e as Error).message });
    return res.status(200).json({ steps });
  }

  // Step 6: Mark active
  try {
    const { error } = await supabase
      .from('slack_connections')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);

    if (error) throw error;
    steps.push({ step: 'mark-active', status: 'OK' });
  } catch (e) {
    steps.push({ step: 'mark-active', status: 'FAIL', detail: (e as Error).message });
  }

  return res.status(200).json({
    steps,
    conclusion: 'All steps completed. Wait 15s for OpenClaw hot-reload, then test the bot.',
  });
}
