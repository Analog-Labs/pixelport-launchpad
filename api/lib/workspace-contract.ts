import { VAULT_SECTION_KEYS } from './vault-contract';
import {
  PAPERCLIP_DEFAULT_CEO_SOURCE,
  PAPERCLIP_DEFAULT_CEO_TEMPLATES,
} from './paperclip-default-ceo-templates';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonRecord
  | JsonValue[];

type JsonRecord = Record<string, JsonValue>;

export const WORKSPACE_CONTRACT_VERSION = '2026-03-26.workspace-compiler-v2';
export const WORKSPACE_MEMORY_CONTRACT_VERSION = 'memory-para-v1';

export const WORKSPACE_ROOT_PROMPT_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOT.md',
  'MEMORY.md',
] as const;

export type WorkspaceRootPromptFile = (typeof WORKSPACE_ROOT_PROMPT_FILES)[number];

export const VAULT_SNAPSHOT_KEYS = VAULT_SECTION_KEYS;

export type VaultSnapshotKey = (typeof VAULT_SNAPSHOT_KEYS)[number];

export type WorkspaceScaffold = {
  directories: string[];
  files: Record<string, string>;
};

const PAPERCLIP_MEMORY_DIRECTORIES = [
  'memory',
  'life/projects',
  'life/areas/people',
  'life/areas/companies',
  'life/resources',
  'life/archives',
  'plans',
] as const;

const PIXELPORT_RUNTIME_DIRECTORIES = [
  'pixelport/content/deliverables',
  'pixelport/vault/snapshots',
  'pixelport/jobs',
  'pixelport/runtime/snapshots',
  'pixelport/ops/events',
  'pixelport/scratch/subagents',
] as const;

const WORKSPACE_SYSTEM_DIRECTORIES = ['system', 'knowledge', 'skills/paperclip'] as const;

const WORKSPACE_KNOWLEDGE_FILES = [
  'knowledge/company-overview.md',
  'knowledge/products-and-offers.md',
  'knowledge/audience-and-icp.md',
  'knowledge/brand-voice.md',
  'knowledge/competitors.md',
] as const;

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

function normalizeGoals(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeText(entry))
    .filter((entry): entry is string => !!entry)
    .slice(0, 8);
}

function parseMissionGoals(missionGoals: string | null): string[] {
  if (!missionGoals) {
    return [];
  }

  const parts = missionGoals
    .split(/\n|,/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (parts.length > 0) {
    return parts;
  }

  return [missionGoals];
}

function relabelChiefOfStaff(value: string): string {
  return value
    .replace(/\bCEO\b/g, 'Chief of Staff')
    .replace(/\bceo\b/g, 'chief of staff');
}

function getAgentName(onboardingData: JsonRecord): string {
  return normalizeText(onboardingData.agent_name) || 'Chief';
}

function getCompanyName(onboardingData: JsonRecord, tenantName: string): string {
  return normalizeText(onboardingData.company_name) || tenantName;
}

function getCompanyUrl(onboardingData: JsonRecord): string | null {
  return normalizeText(onboardingData.company_url);
}

function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as JsonRecord;
    const sortedEntries = Object.keys(record)
      .sort()
      .map((key) => [key, sortJsonValue(record[key])]) as Array<[string, JsonValue]>;
    return Object.fromEntries(sortedEntries);
  }

  return value;
}

function toStableJson(value: JsonValue): string {
  return JSON.stringify(sortJsonValue(value), null, 2);
}

function buildSoulAdditiveContext(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): string {
  const companyName = getCompanyName(params.onboardingData, params.tenantName);
  const companyUrl = getCompanyUrl(params.onboardingData);
  const mission = normalizeText(params.onboardingData.mission_goals)
    || normalizeText(params.onboardingData.mission);
  const goals = normalizeGoals(params.onboardingData.goals);
  const resolvedGoals = goals.length > 0 ? goals : parseMissionGoals(mission);
  const agentName = getAgentName(params.onboardingData);

  const lines = [
    '## PixelPort Additive Onboarding Context',
    '',
    `- Company: ${companyName}`,
    `- Website: ${companyUrl || 'not provided'}`,
    `- Mission: ${mission || 'not provided'}`,
    '- Goals:',
  ];

  if (resolvedGoals.length === 0) {
    lines.push('  - none provided');
  } else {
    for (const goal of resolvedGoals) {
      lines.push(`  - ${goal}`);
    }
  }

  lines.push(`- Chosen Chief of Staff name: ${agentName}`);

  return lines.join('\n');
}

function buildSoulFile(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): string {
  const baseSoul = relabelChiefOfStaff(PAPERCLIP_DEFAULT_CEO_TEMPLATES['SOUL.md']);
  const additiveBlock = buildSoulAdditiveContext(params);
  return `${baseSoul}\n\n---\n\n${additiveBlock}\n`;
}

function buildIdentityFile(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): string {
  const agentName = getAgentName(params.onboardingData);
  return [
    '# IDENTITY.md',
    '',
    `- Name: ${agentName}`,
    '- Role: Chief of Staff',
    '- Operating model: Paperclip-governed execution with OpenClaw runtime',
    '',
    'You are a clear, pragmatic operator focused on durable outcomes.',
    '',
  ].join('\n');
}

function buildUserFile(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): string {
  const companyName = getCompanyName(params.onboardingData, params.tenantName);
  const companyUrl = getCompanyUrl(params.onboardingData);
  return [
    '# USER.md',
    '',
    '- User role: Founder / Board',
    `- Company: ${companyName}`,
    `- Website: ${companyUrl || 'not provided'}`,
    '',
    'Default communication style:',
    '- Be concise and direct.',
    '- Call out risks before execution.',
    '- Provide clear next actions and ownership.',
    '',
  ].join('\n');
}

function buildBootFile(): string {
  return [
    '# BOOT.md',
    '',
    'This file is scaffolded for future startup/recovery automation.',
    'Session 4 policy: scaffold only; do not auto-run boot instructions yet.',
    '',
    'If boot execution is enabled in a future session, prioritize business continuity checks:',
    '1. Confirm Paperclip assignment/ticket state before taking action.',
    '2. Record durable updates in workspace artifacts, not chat-only output.',
    '3. Escalate missing context as explicit follow-ups for the board.',
    '',
  ].join('\n');
}

function buildMemoryFile(): string {
  return [
    '# MEMORY.md',
    '',
    '## Durable Facts',
    '- Keep long-lived company facts here.',
    '',
    '## Working Preferences',
    '- Capture stable operating preferences from the board.',
    '',
    '## Important Decisions',
    '- Record decisions that should persist across sessions.',
    '',
  ].join('\n');
}

function buildKnowledgeFiles(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): Record<(typeof WORKSPACE_KNOWLEDGE_FILES)[number], string> {
  const companyName = getCompanyName(params.onboardingData, params.tenantName);
  const companyUrl = getCompanyUrl(params.onboardingData);
  const mission = normalizeText(params.onboardingData.mission_goals)
    || normalizeText(params.onboardingData.mission);

  return {
    'knowledge/company-overview.md': [
      '# Company Overview',
      '',
      `- Company: ${companyName}`,
      `- Website: ${companyUrl || 'not provided'}`,
      `- Mission: ${mission || 'to be defined'}`,
      '',
      'Capture durable company context here as onboarding evolves.',
      '',
    ].join('\n'),
    'knowledge/products-and-offers.md': [
      '# Products and Offers',
      '',
      'Document current products, pricing, and offer positioning.',
      '',
    ].join('\n'),
    'knowledge/audience-and-icp.md': [
      '# Audience and ICP',
      '',
      'Document ideal customer profile, segments, and demand signals.',
      '',
    ].join('\n'),
    'knowledge/brand-voice.md': [
      '# Brand Voice',
      '',
      'Document writing voice, messaging guardrails, and tone constraints.',
      '',
    ].join('\n'),
    'knowledge/competitors.md': [
      '# Competitors',
      '',
      'Track relevant competitors, positioning, and differentiators.',
      '',
    ].join('\n'),
  };
}

function buildPaperclipSkillFile(): string {
  return [
    '# Paperclip Workspace Skill',
    '',
    'Use this skill to coordinate execution with Paperclip as the control plane.',
    '',
    '## Objective',
    '- Read assigned work from Paperclip before acting.',
    '- Update Paperclip tasks and approvals as work progresses.',
    '- Keep all business-state truth in Paperclip entities, not ad-hoc notes.',
    '',
    '## Runbook',
    '1. Fetch assigned issues and prioritize in-progress items first.',
    '2. Confirm linked goal/project context before execution.',
    '3. Post concise progress updates back to the active ticket thread.',
    '4. If approvals or budget constraints block action, escalate clearly.',
    '',
    '## Boundaries',
    '- This skill is guidance only; API/tool wiring is handled by runtime integration.',
    '- Do not invent task IDs, approval states, or budgets.',
    '',
  ].join('\n');
}

function buildRenderManifest(params: {
  tenantSlug: string;
  onboardingData: JsonRecord;
  requiredDirectories: string[];
}): JsonRecord {
  return {
    contract_version: WORKSPACE_CONTRACT_VERSION,
    memory_contract: WORKSPACE_MEMORY_CONTRACT_VERSION,
    source: {
      ...PAPERCLIP_DEFAULT_CEO_SOURCE,
    },
    tenant_slug: params.tenantSlug,
    root_files: [...WORKSPACE_ROOT_PROMPT_FILES],
    knowledge_files: [...WORKSPACE_KNOWLEDGE_FILES],
    system_files: ['system/onboarding.json', 'system/render-manifest.json'],
    skill_files: ['skills/paperclip/SKILL.md'],
    required_directories: params.requiredDirectories,
    boot_execution: 'scaffold_only',
    paperclip_integration: 'runtime_api_wiring_existing',
    onboarding_input_keys: Object.keys(params.onboardingData).sort(),
  };
}

function buildRootPromptFiles(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): Record<WorkspaceRootPromptFile, string> {
  return {
    'AGENTS.md': `${relabelChiefOfStaff(PAPERCLIP_DEFAULT_CEO_TEMPLATES['AGENTS.md'])}\n`,
    'SOUL.md': buildSoulFile(params),
    'TOOLS.md': `${relabelChiefOfStaff(PAPERCLIP_DEFAULT_CEO_TEMPLATES['TOOLS.md'])}\n`,
    'IDENTITY.md': buildIdentityFile(params),
    'USER.md': buildUserFile(params),
    'HEARTBEAT.md': `${relabelChiefOfStaff(PAPERCLIP_DEFAULT_CEO_TEMPLATES['HEARTBEAT.md'])}\n`,
    'BOOT.md': buildBootFile(),
    'MEMORY.md': buildMemoryFile(),
  };
}

export function buildWorkspaceScaffold(params: {
  tenantName: string;
  tenantSlug: string;
  apiBaseUrl: string;
  onboardingData: JsonRecord | null | undefined;
}): WorkspaceScaffold {
  const onboardingData = asRecord(params.onboardingData) ?? {};
  const rootPrompts = buildRootPromptFiles({
    tenantName: params.tenantName,
    onboardingData,
  });
  const knowledgeFiles = buildKnowledgeFiles({
    tenantName: params.tenantName,
    onboardingData,
  });
  const requiredDirectories = [
    ...PAPERCLIP_MEMORY_DIRECTORIES,
    ...PIXELPORT_RUNTIME_DIRECTORIES,
    ...WORKSPACE_SYSTEM_DIRECTORIES,
  ];
  const renderManifest = buildRenderManifest({
    tenantSlug: params.tenantSlug,
    onboardingData,
    requiredDirectories: [...requiredDirectories],
  });

  return {
    directories: requiredDirectories,
    files: {
      ...rootPrompts,
      ...knowledgeFiles,
      'skills/paperclip/SKILL.md': buildPaperclipSkillFile(),
      'system/onboarding.json': toStableJson(onboardingData),
      'system/render-manifest.json': toStableJson(renderManifest),
      'pixelport/runtime/snapshots/workspace-contract.json': JSON.stringify(
        {
          contract_version: WORKSPACE_CONTRACT_VERSION,
          source: PAPERCLIP_DEFAULT_CEO_SOURCE,
          root_prompt_files: WORKSPACE_ROOT_PROMPT_FILES,
          required_directories: requiredDirectories,
          memory_contract: WORKSPACE_MEMORY_CONTRACT_VERSION,
          tenant_slug: params.tenantSlug,
          boot_execution: 'scaffold_only',
        },
        null,
        2,
      ),
    },
  };
}
