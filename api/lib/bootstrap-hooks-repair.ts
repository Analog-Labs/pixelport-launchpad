import { buildBootstrapHooksConfig } from './onboarding-bootstrap';
import { sshExec } from './droplet-ssh';

function buildBootstrapHooksRepairScript(gatewayToken: string): string {
  const hooksConfig = JSON.stringify(buildBootstrapHooksConfig(gatewayToken), null, 2);

  return `
set -euo pipefail
CONFIG="/opt/openclaw/openclaw.json"
BACKUP="$CONFIG.bak-bootstrap-repair-$(date +%Y%m%d-%H%M%S)"

cp "$CONFIG" "$BACKUP"

cat > /tmp/pixelport-bootstrap-hooks.json << 'HOOKS_JSON'
${hooksConfig}
HOOKS_JSON

python3 << 'PYEOF'
import json, os

config_path = "/opt/openclaw/openclaw.json"
tmp_path = "/tmp/openclaw.bootstrap.tmp"

with open(config_path) as f:
    current = json.load(f)

with open("/tmp/pixelport-bootstrap-hooks.json") as f:
    hooks = json.load(f)

current["hooks"] = hooks

with open(tmp_path, "w") as f:
    json.dump(current, f, indent=2)

os.rename(tmp_path, config_path)
PYEOF

rm -f /tmp/pixelport-bootstrap-hooks.json
chown 1000:1000 "$CONFIG"
docker restart openclaw-gateway >/dev/null

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:18789/ >/dev/null; then
    echo "BOOTSTRAP_HOOKS_READY"
    exit 0
  fi
  sleep 1
done

echo "Gateway did not become healthy after bootstrap hooks repair" >&2
exit 1
`.trim();
}

export async function repairBootstrapHooksOnDroplet(host: string, gatewayToken: string): Promise<string> {
  return sshExec(host, buildBootstrapHooksRepairScript(gatewayToken));
}
