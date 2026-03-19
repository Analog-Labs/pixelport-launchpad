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

export const WORKSPACE_CONTRACT_VERSION = '2026-03-19.paperclip-default-chief.v1';

export const WORKSPACE_ROOT_PROMPT_FILES = [
  'SOUL.md',
  'TOOLS.md',
  'AGENTS.md',
  'HEARTBEAT.md',
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
  return normalizeText(onboardingData.agent_name) || 'Luna';
}

function buildSoulAdditiveContext(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): string {
  const companyName = normalizeText(params.onboardingData.company_name) || params.tenantName;
  const companyUrl = normalizeText(params.onboardingData.company_url);
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

function buildRootPromptFiles(params: {
  tenantName: string;
  onboardingData: JsonRecord;
}): Record<WorkspaceRootPromptFile, string> {
  return {
    'AGENTS.md': `${relabelChiefOfStaff(PAPERCLIP_DEFAULT_CEO_TEMPLATES['AGENTS.md'])}\n`,
    'HEARTBEAT.md': `${relabelChiefOfStaff(PAPERCLIP_DEFAULT_CEO_TEMPLATES['HEARTBEAT.md'])}\n`,
    'TOOLS.md': `${relabelChiefOfStaff(PAPERCLIP_DEFAULT_CEO_TEMPLATES['TOOLS.md'])}\n`,
    'SOUL.md': buildSoulFile(params),
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

  return {
    directories: [
      ...PAPERCLIP_MEMORY_DIRECTORIES,
      ...PIXELPORT_RUNTIME_DIRECTORIES,
    ],
    files: {
      ...rootPrompts,
      'pixelport/runtime/snapshots/workspace-contract.json': JSON.stringify(
        {
          contract_version: WORKSPACE_CONTRACT_VERSION,
          source: PAPERCLIP_DEFAULT_CEO_SOURCE,
          applied_at: new Date().toISOString(),
          root_prompt_files: WORKSPACE_ROOT_PROMPT_FILES,
          tenant_slug: params.tenantSlug,
        },
        null,
        2,
      ),
    },
  };
}
