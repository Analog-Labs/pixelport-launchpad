import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Client as SSHClient } from 'ssh2';

const SSH_PRIVATE_KEY = process.env.SSH_PRIVATE_KEY?.replace(/\\n/g, '\n');
const LITELLM_URL = process.env.LITELLM_URL;

/**
 * GET /api/debug/backfill-litellm-config
 *
 * One-time backfill: injects `models.providers.litellm` into existing tenant
 * configs and updates model refs from `openai/` to `litellm/`.
 *
 * Query params:
 *   ?secret=<API_KEY_ENCRYPTION_KEY>  — required
 *   &execute=true                     — apply changes (default: dry-run)
 *
 * DELETE this file after successful backfill run.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const secret = typeof req.query.secret === 'string' ? req.query.secret : '';
  const expected = process.env.API_KEY_ENCRYPTION_KEY;
  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const execute = req.query.execute === 'true';

  const url = process.env.SUPABASE_PROJECT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Missing Supabase config' });
  if (!SSH_PRIVATE_KEY) return res.status(500).json({ error: 'Missing SSH_PRIVATE_KEY' });
  if (!LITELLM_URL) return res.status(500).json({ error: 'Missing LITELLM_URL' });

  const supabase = createClient(url, key);

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, slug, droplet_ip, status')
    .not('droplet_ip', 'is', null)
    .in('status', ['active', 'provisioned']);

  if (error) return res.status(500).json({ error: 'Query failed', detail: error.message });
  if (!tenants || tenants.length === 0) return res.status(200).json({ message: 'No tenants to backfill' });

  const litellmBaseUrl = `${LITELLM_URL}/v1`;
  const results: Array<{ slug: string; ip: string; action: string; error?: string }> = [];

  for (const tenant of tenants) {
    const ip = tenant.droplet_ip as string;
    try {
      // Check if litellm provider already exists
      const checkOutput = await sshExec(ip, buildCheckScript());
      const hasLitellm = checkOutput.trim() === 'HAS_LITELLM';

      if (hasLitellm) {
        results.push({ slug: tenant.slug, ip, action: 'skip — litellm provider already present' });
        continue;
      }

      if (!execute) {
        results.push({ slug: tenant.slug, ip, action: 'dry-run — would inject litellm provider + update model refs' });
        continue;
      }

      // Apply backfill
      const output = await sshExec(ip, buildBackfillScript(litellmBaseUrl));
      results.push({ slug: tenant.slug, ip, action: `applied — ${output.trim()}` });
    } catch (err) {
      results.push({ slug: tenant.slug, ip, action: 'error', error: String(err) });
    }
  }

  return res.status(200).json({
    mode: execute ? 'EXECUTE' : 'DRY-RUN',
    timestamp: new Date().toISOString(),
    tenants_checked: tenants.length,
    results,
  });
}

function buildCheckScript(): string {
  return `python3 -c "
import json, sys
config = json.load(open('/opt/openclaw/openclaw.json'))
providers = config.get('models', {}).get('providers', {})
sys.stdout.write('HAS_LITELLM' if 'litellm' in providers else 'MISSING')
"`;
}

function buildBackfillScript(litellmBaseUrl: string): string {
  // OpenClaw uses ${OPENAI_API_KEY} for runtime env var substitution
  const apiKeyRef = '${OPENAI_API_KEY}';
  return `
set -euo pipefail
CONFIG="/opt/openclaw/openclaw.json"
cp "$CONFIG" "$CONFIG.bak-$(date +%s)"

# Write litellm provider JSON to a temp file (avoids heredoc escaping issues)
cat > /tmp/litellm-provider.json << 'PROVIDER_JSON'
{
  "baseUrl": "${litellmBaseUrl}",
  "apiKey": "${apiKeyRef}",
  "api": "openai-responses",
  "authHeader": true,
  "models": [
    {"id": "gpt-5.2-codex", "name": "GPT 5.2 Codex", "api": "openai-responses", "reasoning": false, "input": ["text"], "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}, "contextWindow": 128000, "maxTokens": 32000},
    {"id": "gpt-4o-mini", "name": "GPT 4o Mini", "api": "openai-responses", "reasoning": false, "input": ["text"], "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}, "contextWindow": 128000, "maxTokens": 16384},
    {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "api": "openai-responses", "reasoning": false, "input": ["text"], "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}, "contextWindow": 128000, "maxTokens": 16384}
  ]
}
PROVIDER_JSON

python3 << 'PYEOF'
import json, os

config_path = "/opt/openclaw/openclaw.json"
tmp_path = "/tmp/openclaw.json.tmp"

with open(config_path) as f:
    config = json.load(f)

with open("/tmp/litellm-provider.json") as f:
    litellm_provider = json.load(f)

if "models" not in config:
    config["models"] = {}
config["models"]["mode"] = "merge"
if "providers" not in config["models"]:
    config["models"]["providers"] = {}
config["models"]["providers"]["litellm"] = litellm_provider

# 2. Update model refs from openai/ to litellm/
def update_model_refs(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and v.startswith("openai/"):
                obj[k] = "litellm/" + v[len("openai/"):]
            elif isinstance(v, (dict, list)):
                update_model_refs(v)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            if isinstance(item, str) and item.startswith("openai/"):
                obj[i] = "litellm/" + item[len("openai/"):]
            elif isinstance(item, (dict, list)):
                update_model_refs(item)

if "agents" in config:
    update_model_refs(config["agents"])

with open(tmp_path, "w") as f:
    json.dump(config, f, indent=2)
os.rename(tmp_path, config_path)
print("BACKFILL_COMPLETE")
PYEOF

rm -f /tmp/litellm-provider.json
chown 1000:1000 "$CONFIG"
docker restart openclaw-gateway 2>/dev/null || true
echo "DONE"
`.trim();
}

function sshExec(host: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SSH_PRIVATE_KEY) {
      reject(new Error('SSH_PRIVATE_KEY not set'));
      return;
    }
    const conn = new SSHClient();
    const timeout = setTimeout(() => { conn.end(); reject(new Error('SSH timeout (30s)')); }, 30_000);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timeout); conn.end(); reject(err); return; }
        let stdout = '';
        let stderr = '';
        stream.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
        stream.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          conn.end();
          if (code !== 0) { reject(new Error(`SSH failed (code ${code}): ${stderr.trim()}`)); return; }
          resolve(stdout);
        });
      });
    });

    conn.on('error', (error) => { clearTimeout(timeout); reject(error); });
    conn.connect({ host, port: 22, username: 'root', privateKey: SSH_PRIVATE_KEY, readyTimeout: 15_000 });
  });
}
