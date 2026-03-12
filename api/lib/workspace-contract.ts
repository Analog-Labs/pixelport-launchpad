import {
  VAULT_SECTION_KEYS,
  getVaultSectionSnapshotPath,
} from "./vault-contract";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonRecord
  | JsonValue[];

type JsonRecord = Record<string, JsonValue>;

type ScanResults = {
  company_description?: string;
  value_proposition?: string;
  target_audience?: string;
  brand_voice?: string;
  industry?: string;
  key_products?: unknown;
  error?: unknown;
};

export const WORKSPACE_CONTRACT_VERSION = '2026-03-08.foundation-spine.v1';

export const WORKSPACE_ROOT_PROMPT_FILES = [
  'SOUL.md',
  'TOOLS.md',
  'AGENTS.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
] as const;

export type WorkspaceRootPromptFile = (typeof WORKSPACE_ROOT_PROMPT_FILES)[number];

export const VAULT_SNAPSHOT_KEYS = VAULT_SECTION_KEYS;

export type VaultSnapshotKey = (typeof VAULT_SNAPSHOT_KEYS)[number];

export type WorkspaceScaffold = {
  directories: string[];
  files: Record<string, string>;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getAgentName(onboardingData: JsonRecord): string {
  return normalizeText(onboardingData.agent_name) || 'Luna';
}

function getToneDescription(onboardingData: JsonRecord): string {
  const tone = normalizeText(onboardingData.agent_tone) || 'professional';

  const toneMap: Record<string, string> = {
    casual: 'Friendly, conversational, and approachable. Uses simple language and stays human.',
    professional: 'Professional and clear. Concise, confident, and practical without heavy jargon.',
    bold: 'Direct, energetic, and opinionated. Pushes for ambitious outcomes and challenges weak assumptions.',
  };

  return toneMap[tone] || toneMap.professional;
}

function getScanResults(onboardingData: JsonRecord): ScanResults | null {
  const scanResults = asRecord(onboardingData.scan_results);
  if (!scanResults || scanResults.error) {
    return null;
  }

  return scanResults as unknown as ScanResults;
}

function normalizeGoals(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeText(entry))
    .filter((entry): entry is string => !!entry)
    .slice(0, 6);
}

function listKeyProducts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeText(entry))
    .filter((entry): entry is string => !!entry);
}

function buildBrandContext(scanResults: ScanResults | null): string {
  if (!scanResults) {
    return 'No website scan results are available yet. Ask the human for positioning, audience, and product context before making strong strategic claims.';
  }

  const lines: string[] = [];
  if (scanResults.company_description) lines.push(`- About: ${scanResults.company_description}`);
  if (scanResults.value_proposition) lines.push(`- Value proposition: ${scanResults.value_proposition}`);
  if (scanResults.target_audience) lines.push(`- Target audience: ${scanResults.target_audience}`);
  if (scanResults.brand_voice) lines.push(`- Observed brand voice: ${scanResults.brand_voice}`);
  if (scanResults.industry) lines.push(`- Industry: ${scanResults.industry}`);

  const products = listKeyProducts(scanResults.key_products);
  if (products.length > 0) {
    lines.push(`- Key products/services: ${products.join(', ')}`);
  }

  return lines.join('\n');
}

function buildCompanyProfileSnapshot(scanResults: ScanResults | null): string {
  if (!scanResults) {
    return [
      '# Company Profile Snapshot',
      '',
      'No synced company profile exists yet.',
      'Promote verified findings here once the Chief has completed onboarding research.',
    ].join('\n');
  }

  const lines = [
    '# Company Profile Snapshot',
    '',
    scanResults.company_description ? `## About\n${scanResults.company_description}` : null,
    scanResults.value_proposition ? `## Value Proposition\n${scanResults.value_proposition}` : null,
    scanResults.target_audience ? `## Target Audience\n${scanResults.target_audience}` : null,
    scanResults.industry ? `## Industry\n${scanResults.industry}` : null,
  ].filter((entry): entry is string => !!entry);

  const products = listKeyProducts(scanResults.key_products);
  if (products.length > 0) {
    lines.push(`## Key Products / Services\n- ${products.join('\n- ')}`);
  }

  return lines.join('\n\n');
}

function buildBrandVoiceSnapshot(scanResults: ScanResults | null): string {
  if (!scanResults?.brand_voice) {
    return [
      '# Brand Voice Snapshot',
      '',
      'No synced brand voice exists yet.',
      'Promote concrete language guidance here after review.',
    ].join('\n');
  }

  return [
    '# Brand Voice Snapshot',
    '',
    '## Observed Voice',
    scanResults.brand_voice,
  ].join('\n\n');
}

function buildPlaceholderSnapshot(title: string, description: string): string {
  return [
    `# ${title}`,
    '',
    description,
    'Replace this placeholder with promoted runtime knowledge once the Chief has verified it.',
  ].join('\n');
}

function buildVaultSnapshots(scanResults: ScanResults | null): Record<string, string> {
  return {
    'pixelport/vault/snapshots/company_profile.md': buildCompanyProfileSnapshot(scanResults),
    'pixelport/vault/snapshots/brand_voice.md': buildBrandVoiceSnapshot(scanResults),
    'pixelport/vault/snapshots/icp.md': buildPlaceholderSnapshot(
      'Ideal Customer Profile Snapshot',
      'No synced ICP snapshot exists yet.'
    ),
    'pixelport/vault/snapshots/competitors.md': buildPlaceholderSnapshot(
      'Competitor Snapshot',
      'No synced competitor snapshot exists yet.'
    ),
    'pixelport/vault/snapshots/products.md': buildPlaceholderSnapshot(
      'Products And Services Snapshot',
      'No synced products snapshot exists yet.'
    ),
  };
}

function buildGoalsList(goals: string[]): string {
  if (goals.length === 0) {
    return '- No onboarding goals were captured in canonical truth yet.';
  }

  return goals.map((goal) => `- ${goal}`).join('\n');
}

function buildBulletList(items: string[], fallback: string): string {
  if (items.length === 0) {
    return `- ${fallback}`;
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function buildBusinessContextMemory(params: {
  tenantName: string;
  onboardingData: JsonRecord;
  scanResults: ScanResults | null;
}): string {
  const goals = normalizeGoals(params.onboardingData.goals);
  const companyUrl = normalizeText(params.onboardingData.company_url);
  const scanResults = params.scanResults;
  const products = listKeyProducts(scanResults?.key_products);
  const brandVoiceSignals = [
    normalizeText(scanResults?.brand_voice),
    scanResults?.value_proposition
      ? `Repeat the proof point: ${scanResults.value_proposition}`
      : null,
  ].filter((entry): entry is string => !!entry);
  const audienceSignals = [
    normalizeText(scanResults?.target_audience),
    goals.length > 0
      ? `Onboarding goals currently prioritize: ${goals.join(', ')}`
      : null,
  ].filter((entry): entry is string => !!entry);
  const productSignals = [
    ...products,
    scanResults?.value_proposition
      ? `Core promise: ${scanResults.value_proposition}`
      : null,
  ].filter((entry): entry is string => !!entry);

  const lines = [
    '# Business Context',
    '',
    `## Company`,
    `- Tenant: ${params.tenantName}`,
    companyUrl ? `- Website: ${companyUrl}` : '- Website: not captured in onboarding data.',
    scanResults?.company_description
      ? `- Description: ${scanResults.company_description}`
      : '- Description: not yet promoted into canonical truth.',
    scanResults?.value_proposition
      ? `- Value proposition: ${scanResults.value_proposition}`
      : '- Value proposition: not yet promoted into canonical truth.',
    scanResults?.industry
      ? `- Industry: ${scanResults.industry}`
      : '- Industry: not yet promoted into canonical truth.',
    '',
    '## Onboarding Goals',
    buildGoalsList(goals),
    '',
    '## Brand Voice Signals',
    buildBulletList(
      brandVoiceSignals,
      'Use `pixelport/vault/snapshots/brand_voice.md` as the canonical source until stronger guidance is promoted.'
    ),
    '',
    '## Audience And ICP Signals',
    buildBulletList(
      audienceSignals,
      'Use `pixelport/vault/snapshots/icp.md` as the canonical source until ICP details are promoted.'
    ),
    '',
    '## Products And Services Signals',
    buildBulletList(
      productSignals,
      'Use `pixelport/vault/snapshots/products.md` as the canonical source until product details are promoted.'
    ),
    '',
    '## Competitor Watchlist',
    '- Use `pixelport/vault/snapshots/competitors.md` as the canonical source until verified competitors are promoted.',
    '',
    '## Canonical Snapshots',
    '- Company profile: `pixelport/vault/snapshots/company_profile.md`',
    '- Brand voice: `pixelport/vault/snapshots/brand_voice.md`',
    '- ICP: `pixelport/vault/snapshots/icp.md`',
    '- Products/services: `pixelport/vault/snapshots/products.md`',
    '- Competitors: `pixelport/vault/snapshots/competitors.md`',
  ];

  return lines.join('\n');
}

function buildOperatingModelMemory(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): string {
  const agentName = getAgentName(params.onboardingData);

  return [
    '# Operating Model',
    '',
    '## Chief Identity',
    `- Chief name: ${agentName}`,
    `- Role: AI Chief of Staff for ${params.tenantName}`,
    `- Tone contract: ${getToneDescription(params.onboardingData)}`,
    '',
    '## Source Of Truth',
    '- Workspace files on the tenant droplet are the runtime source of truth.',
    '- The dashboard is a projection of canonical backend and workspace truth.',
    '- Native memory is a concise fast-recall layer derived from canonical truth.',
    '- Mem0, if enabled later, is only for soft learned memory and must not replace canonical truth.',
    '',
    '## Verification Rules',
    '- Use native memory for fast recall.',
    '- Verify against canonical workspace truth when correctness matters.',
    '- Canonical root files: `SOUL.md`, `TOOLS.md`, `AGENTS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`.',
    '- Canonical business snapshots: `pixelport/vault/snapshots/*.md`.',
    '',
    '## Refresh Rules',
    '- When canonical truth changes materially, refresh the relevant native memory artifact in the same work cycle.',
    '- Do not create a second competing truth store for company context.',
  ].join('\n');
}

function buildActivePrioritiesMemory(onboardingData: JsonRecord): string {
  const goals = normalizeGoals(onboardingData.goals);

  return [
    '# Active Priorities',
    '',
    '## Onboarding Goals',
    buildGoalsList(goals),
    '',
    '## Current Operational Signals',
    '- No additional runtime signals have been promoted into canonical truth yet.',
    '- Until new durable work is written back, use onboarding goals plus the latest vault snapshots as the active planning baseline.',
    '',
    '## Current Strategic Priorities',
    '- No current strategic priorities have been promoted into canonical truth yet.',
    '- When strategic priorities are promoted into canonical truth, summarize them here for fast recall.',
    '',
    '## Refresh Trigger',
    '- When strategic priorities are explicitly updated in canonical truth, refresh this file in the same work cycle.',
  ].join('\n');
}

function buildRootMemoryFile(params: {
  tenantName: string;
  onboardingData: JsonRecord;
  scanResults: ScanResults | null;
}): string {
  const agentName = getAgentName(params.onboardingData);
  const goals = normalizeGoals(params.onboardingData.goals);
  const companyUrl = normalizeText(params.onboardingData.company_url);

  return [
    '# Native Memory',
    '',
    `This is ${agentName}'s fast recall layer for ${params.tenantName}.`,
    '',
    '## How To Use This Layer',
    '- Use native memory for fast recall.',
    '- Verify against canonical workspace truth when correctness matters.',
    '- Mem0 is optional and only for soft learned memory.',
    '- When canonical truth changes materially, refresh this file and the related files in `memory/` in the same work cycle.',
    '',
    '## Quick Facts',
    `- Chief: ${agentName}`,
    companyUrl ? `- Website: ${companyUrl}` : '- Website: not yet captured in canonical truth.',
    params.scanResults?.value_proposition
      ? `- Value proposition: ${params.scanResults.value_proposition}`
      : '- Value proposition: not yet promoted into canonical truth.',
    goals.length > 0
      ? `- Onboarding goals: ${goals.join(' | ')}`
      : '- Onboarding goals: none captured yet.',
    params.scanResults?.industry
      ? `- Industry: ${params.scanResults.industry}`
      : '- Industry: not yet promoted into canonical truth.',
    '',
    '## Canonical References',
    '- `memory/business-context.md`',
    '- `memory/operating-model.md`',
    '- `memory/active-priorities.md`',
    '- `pixelport/vault/snapshots/*.md`',
  ].join('\n');
}

function buildMemoryArtifacts(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): Record<string, string> {
  const scanResults = getScanResults(params.onboardingData);

  return {
    'MEMORY.md': buildRootMemoryFile({
      tenantName: params.tenantName,
      onboardingData: params.onboardingData,
      scanResults,
    }),
    'memory/business-context.md': buildBusinessContextMemory({
      tenantName: params.tenantName,
      onboardingData: params.onboardingData,
      scanResults,
    }),
    'memory/operating-model.md': buildOperatingModelMemory({
      tenantName: params.tenantName,
      onboardingData: params.onboardingData,
    }),
    'memory/active-priorities.md': buildActivePrioritiesMemory(params.onboardingData),
  };
}

function buildSoulFile(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): string {
  const agentName = getAgentName(params.onboardingData);
  const scanResults = getScanResults(params.onboardingData);

  return `# ${agentName} — AI Chief of Staff for ${params.tenantName}

## Identity
You are ${agentName}, the AI Chief of Staff for ${params.tenantName}. You are the only agent the human speaks with directly. You coordinate strategy, research, content operations, and follow-through across the workspace.

## Personality And Tone
${getToneDescription(params.onboardingData)}

## Operating Posture
- Act like one persistent Chief with disposable specialist sub-agents when needed.
- Do not present permanent named teammates to the human.
- Keep product truth aligned with PixelPort APIs and the \`pixelport/\` workspace contract.
- Be explicit about uncertainty. If evidence is missing, record what you know and what still needs confirmation.

## Knowledge Base
${buildBrandContext(scanResults)}

## Workspace Contract
- Root prompt files live at workspace root: \`SOUL.md\`, \`TOOLS.md\`, \`AGENTS.md\`, \`HEARTBEAT.md\`, \`BOOTSTRAP.md\`.
- Durable runtime artifacts belong under \`pixelport/\`.
- Disposable worker output belongs under \`pixelport/scratch/subagents/\`.
- Promote only verified runtime artifacts into stable \`pixelport/\` locations.
- Emit \`workspace-events\` when commands progress or a runtime artifact is promoted.

## Native Memory
- Use native memory for fast recall through \`MEMORY.md\` and \`memory/\`.
- Verify against canonical workspace truth when correctness matters.
- Mem0 is optional and only for soft learned memory if it is enabled later.
- When canonical truth changes materially, refresh the relevant native memory artifact in the same work cycle.

## Delivery Rules
- Keep current task, vault, competitor, and image-generation APIs working as the live dashboard path.
- Use only these task types: \`draft_content\`, \`research\`, \`competitor_analysis\`, \`strategy\`, \`report\`.
- Use only these task statuses: \`pending\`, \`running\`, \`completed\`, \`failed\`, \`cancelled\`.
- Treat the dashboard as a projection of real work, not a place for placeholders.
`;
}

function buildToolsFile(params: {
  apiBaseUrl: string;
}): string {
  const vaultRefreshKeys = VAULT_SECTION_KEYS.map((sectionKey) => `\`${sectionKey}\``).join(', ');

  return `# PixelPort Tooling Guide

## Setup
\`\`\`bash
API_BASE_URL="${params.apiBaseUrl}"
: "\${PIXELPORT_API_KEY:?PIXELPORT_API_KEY must already be injected into the running container}"
\`\`\`

The running OpenClaw container already receives its environment variables at startup. Do not source a host env file from inside the container.

## Direct Model Access Checks
\`\`\`bash
# Only needed when you are making direct model or gateway calls from the shell.
: "\${OPENAI_API_KEY:?OPENAI_API_KEY is required for direct model access}"
: "\${OPENAI_BASE_URL:?OPENAI_BASE_URL is required for direct model access}"
\`\`\`

## Live Product Writes
\`\`\`bash
# Read vault state
curl -s -H "X-Agent-Key: $PIXELPORT_API_KEY" "$API_BASE_URL/api/agent/vault"

# Update a vault section
curl -s -X PUT \\
  -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"Verified markdown content","status":"ready"}' \\
  "$API_BASE_URL/api/agent/vault/company_profile"

# Create a task
curl -s -X POST \\
  -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_role":"Chief of Staff","task_type":"research","task_description":"Research positioning","status":"running"}' \\
  "$API_BASE_URL/api/agent/tasks"

# Add a competitor
curl -s -X POST \\
  -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"company_name":"Example Competitor","summary":"Direct competitor","threat_level":"medium"}' \\
  "$API_BASE_URL/api/agent/competitors"

# Generate an image
curl -s -X POST \\
  -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Editorial campaign concept","provider":"openai","model":"gpt-image-1","size":"1024x1024"}' \\
  "$API_BASE_URL/api/agent/generate-image"
\`\`\`

## Workspace Events
\`\`\`bash
curl -s -X POST \\
  -H "X-Agent-Key: $PIXELPORT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_id":"cmd-123-running",
    "event_type":"command.running",
    "command_id":"cmd-123",
    "entity_type":"command",
    "entity_id":"cmd-123",
    "payload":{"summary":"Execution started"}
  }' \\
  "$API_BASE_URL/api/agent/workspace-events"
\`\`\`

## Native Memory Workflow
\`\`\`bash
# Search native memory for fast recall
openclaw memory search --query "latest priorities"

# Reindex native memory after materially updating canonical truth
openclaw memory index --force
\`\`\`

- Use native memory for fast recall, then verify against canonical workspace truth in root files and \`pixelport/vault/snapshots/\` when correctness matters.
- If \`MEMORY.md\` or \`memory/*.md\` changes materially, refresh the native memory index in the same work cycle.

## Vault Refresh Commands
- Valid vault refresh section keys: ${vaultRefreshKeys}
- A \`vault_refresh\` command always targets exactly one \`vault_section\`.
- Start by reading the current vault state through \`GET /api/agent/vault\`.
- When work begins, set the target section to \`"populating"\` through \`PUT /api/agent/vault/<section_key>\`.
- Update the durable markdown snapshot at \`${getVaultSectionSnapshotPath('company_profile').replace('company_profile', '<section_key>')}\`.
- Emit \`runtime.artifact.promoted\` with \`entity_type: "vault_section"\` and the same \`entity_id\`.
- Finish by writing the final markdown and \`status: "ready"\` through \`PUT /api/agent/vault/<section_key>\`.
- If the refresh must fail or be cancelled after switching to \`"populating"\`, restore the prior content with \`status: "ready"\` before the terminal command event.
- Emit exactly one terminal command event after the final vault write.

## File Placement Rules
- Durable packages: \`pixelport/content/deliverables/<deliverable-id>/\`
- Vault snapshots: \`pixelport/vault/snapshots/\`
- Runtime status snapshots: \`pixelport/runtime/snapshots/\`
- Local append-only ops logs: \`pixelport/ops/events/\`
- Temporary worker output: \`pixelport/scratch/subagents/\`
`;
}

function buildAgentsFile(): string {
  return `# Sub-Agent Delegation Guide

## Delegation Rules
- Spawn disposable specialist sub-agents only when parallel research or drafting materially improves speed or quality.
- Do not expose sub-agent identities as permanent teammates to the human.
- Give each sub-agent one narrow goal, expected output format, and a promotion path back to the main workspace.

## Output Rules
- Sub-agents may write temporary notes under \`pixelport/scratch/subagents/<run-id>/\`.
- The main Chief is responsible for reviewing and promoting final artifacts into stable \`pixelport/\` paths.
- Only the main Chief should emit final command terminal events unless a delegated worker is explicitly finishing the command on behalf of the Chief.
`;
}

function buildHeartbeatFile(): string {
  return `# Heartbeat Checklist

If heartbeat or a scheduled check-in runs, use this order:
1. Review incomplete command work and emit a status event if reality changed.
2. Check whether any durable runtime artifact should be promoted into \`pixelport/\`.
3. Sync vault snapshot files when new verified knowledge exists.
4. Refresh native memory artifacts after canonical truth changes materially.
5. Avoid duplicate work. Prefer continuing or closing an existing command over starting a parallel duplicate.
`;
}

function buildBootstrapFile(params: {
  tenantName: string;
  tenantSlug: string;
  onboardingData: JsonRecord;
}): string {
  const agentName = getAgentName(params.onboardingData);

  return `# Workspace Bootstrap

You are ${agentName} inside the PixelPort workspace for ${params.tenantName} (${params.tenantSlug}).

## First-Run Checklist
1. Read \`SOUL.md\`, \`TOOLS.md\`, \`AGENTS.md\`, and \`HEARTBEAT.md\`.
2. Confirm the \`pixelport/\` directories exist before creating new runtime artifacts.
3. Treat \`pixelport/runtime/snapshots/status.json\` as the local contract summary.
4. Keep synced vault context in \`pixelport/vault/snapshots/\`.
5. Keep \`MEMORY.md\` and \`memory/\` as the native fast-recall layer derived from canonical truth.
6. Emit \`workspace-events\` for command progress and promoted runtime artifacts.

## Important
- This foundation slice keeps the current task, vault, and competitor APIs as the live dashboard path.
- The command ledger is additive; onboarding bootstrap is not retrofitted into it in this slice.
- Do not invent permanent sub-agent teammates.
`;
}

function buildStatusSnapshot(params: {
  tenantName: string;
  tenantSlug: string;
  onboardingData: JsonRecord;
}): string {
  return JSON.stringify(
    {
      contract_version: WORKSPACE_CONTRACT_VERSION,
      tenant_name: params.tenantName,
      tenant_slug: params.tenantSlug,
      agent_name: getAgentName(params.onboardingData),
      generated_at: new Date().toISOString(),
      direct_write_mode: true,
      directories: {
        content_deliverables: 'pixelport/content/deliverables',
        vault_snapshots: 'pixelport/vault/snapshots',
        runtime_snapshots: 'pixelport/runtime/snapshots',
        ops_events: 'pixelport/ops/events',
        native_memory: 'memory',
        scratch_subagents: 'pixelport/scratch/subagents',
      },
    },
    null,
    2
  );
}

function buildOpsBootstrapEvent(params: {
  tenantSlug: string;
  onboardingData: JsonRecord;
}): string {
  return JSON.stringify({
    event_type: 'workspace.contract.scaffolded',
    contract_version: WORKSPACE_CONTRACT_VERSION,
    tenant_slug: params.tenantSlug,
    agent_name: getAgentName(params.onboardingData),
    occurred_at: new Date().toISOString(),
  });
}

export function buildWorkspaceScaffold(params: {
  tenantName: string;
  tenantSlug: string;
  apiBaseUrl: string;
  onboardingData: JsonRecord | null | undefined;
}): WorkspaceScaffold {
  const onboardingData = asRecord(params.onboardingData) ?? {};
  const scanResults = getScanResults(onboardingData);
  const opsEventDate = new Date().toISOString().slice(0, 10);

  return {
    directories: [
      'memory',
      'pixelport/content/deliverables',
      'pixelport/vault/snapshots',
      'pixelport/jobs',
      'pixelport/runtime/snapshots',
      'pixelport/ops/events',
      'pixelport/scratch/subagents',
    ],
    files: {
      ...buildMemoryArtifacts({
        tenantName: params.tenantName,
        onboardingData,
      }),
      'SOUL.md': buildSoulFile({
        tenantName: params.tenantName,
        onboardingData,
      }),
      'TOOLS.md': buildToolsFile({
        apiBaseUrl: params.apiBaseUrl,
      }),
      'AGENTS.md': buildAgentsFile(),
      'HEARTBEAT.md': buildHeartbeatFile(),
      'BOOTSTRAP.md': buildBootstrapFile({
        tenantName: params.tenantName,
        tenantSlug: params.tenantSlug,
        onboardingData,
      }),
      'pixelport/runtime/snapshots/status.json': buildStatusSnapshot({
        tenantName: params.tenantName,
        tenantSlug: params.tenantSlug,
        onboardingData,
      }),
      [`pixelport/ops/events/${opsEventDate}.jsonl`]: `${buildOpsBootstrapEvent({
        tenantSlug: params.tenantSlug,
        onboardingData,
      })}\n`,
      ...buildVaultSnapshots(scanResults),
    },
  };
}
