# P6 Launch-Critical Runtime Canary

- **Date:** 2026-03-18
- **Branch:** `codex/p6-e2e-handoff-golden-image-scan-hardening`
- **PR:** `#17` (`fix(p6): launch auto-auth + scan hardening + golden image backup runbook`)
- **Canary host:** `157.230.10.108`

## Objective

Validate the launch-critical path before any new feature work:

1. Launch URL should auto-auth into the tenant runtime workspace.
2. Agent runtime should accept a task and produce a response.
3. Local fail-safe artifact backup should exist outside droplets.

## Evidence

### 1) Auto-login launch URL path

- Used Playwright against:
  - `http://157.230.10.108:18789/#token=<gateway_token>`
- Result:
  - Browser navigated to `http://157.230.10.108:18789/chat?session=main`
  - Page title: `OpenClaw Control`
  - Snapshot artifact:
    - `.playwright-cli/page-2026-03-18T12-39-41-791Z.yml`
- Interpretation:
  - Token launch URL is accepted and routes into the workspace UI path (no login form).

### 2) Agent response path

- Triggered runtime hook endpoint:
  - `POST http://127.0.0.1:18789/hooks/agent`
  - Auth: derived hook token (`hk-...`) from gateway token
- Response:
  - `{"ok":true,"runId":"..."}`
- Verified assistant output in runtime session logs:
  - `/opt/openclaw/agents/main/sessions/b647a8e5-e003-45e1-b553-9a22343438d3.jsonl`
  - `/opt/openclaw/agents/main/sessions/eaed607c-4305-4da4-825c-bdb828676562.jsonl`
  - Assistant final text in both sessions: `PIXELPORT_AGENT_OK`

### 3) Local fail-safe backup

- Backup root:
  - `/Users/sanchal/pixelport-artifacts/golden-image-backups`
- Captured archive:
  - `docker-image-archives/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.tar.gz`
- Checksum verified:
  - `checksums/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.sha256`
  - `shasum -a 256 -c ...` => `OK`
- Manifest + source snapshot captured:
  - `manifests/2026-03-18-pixelport-paperclip-2026.3.11-handoff-p1.manifest.txt`
  - `cloud-init-snapshots/2026-03-18-provision-tenant-source.ts`

## Blocker Found

The Control UI shows:

- `control ui requires device identity (use HTTPS or localhost secure context)`
- `Disconnected from gateway`

This appears when opening runtime over plain HTTP droplet IP from a remote browser context.  
So launch URL auto-auth works, but full interactive workspace UX remains blocked unless we:

1. serve runtime over HTTPS per tenant, or
2. disable Control UI device auth (security tradeoff, not recommended without explicit approval).

## Verdict

- **Runtime token launch:** pass
- **Agent response via runtime hooks:** pass
- **Press Launch and immediately use workspace chat over current HTTP IP path:** **blocked** by secure-context/device-identity enforcement
