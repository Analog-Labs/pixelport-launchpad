type JsonRecord = Record<string, unknown>;

export const KNOWLEDGE_FILE_KEYS = [
  'knowledge/company-overview.md',
  'knowledge/products-and-offers.md',
  'knowledge/audience-and-icp.md',
  'knowledge/brand-voice.md',
  'knowledge/competitors.md',
] as const;

export type KnowledgeFileKey = (typeof KNOWLEDGE_FILE_KEYS)[number];
export type KnowledgeSyncStatus = 'pending' | 'synced' | 'failed';

export interface KnowledgeSyncSummary {
  status: KnowledgeSyncStatus;
  revision: number;
  synced_revision: number | null;
  seeded_revision: number | null;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string | null;
}

export interface KnowledgeMirrorState {
  revision: number;
  files: Record<KnowledgeFileKey, string>;
  sync: KnowledgeSyncSummary;
}

export interface KnowledgeSection {
  key: KnowledgeFileKey;
  title: string;
  content: string;
}

const SECTION_TITLES: Record<KnowledgeFileKey, string> = {
  'knowledge/company-overview.md': 'Company Overview',
  'knowledge/products-and-offers.md': 'Products and Offers',
  'knowledge/audience-and-icp.md': 'Audience and ICP',
  'knowledge/brand-voice.md': 'Brand Voice',
  'knowledge/competitors.md': 'Competitors',
};

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNullableString(value: unknown): string | null {
  const parsed = readString(value).trim();
  return parsed.length > 0 ? parsed : null;
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const parsed = Math.trunc(value);
  return parsed >= 1 ? parsed : null;
}

function readSyncStatus(value: unknown): KnowledgeSyncStatus | null {
  if (value !== 'pending' && value !== 'synced' && value !== 'failed') {
    return null;
  }
  return value;
}

function readCompanyWebsite(onboardingData: JsonRecord | null): string | null {
  if (!onboardingData) {
    return null;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.company)) {
    const nested = readNullableString(onboardingData.v2.company.website);
    if (nested) {
      return nested;
    }
  }

  return readNullableString(onboardingData.company_url);
}

function readMissionGoals(onboardingData: JsonRecord | null): string {
  if (!onboardingData) {
    return 'to be defined';
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.strategy)) {
    const nested = readNullableString(onboardingData.v2.strategy.mission_goals);
    if (nested) {
      return nested;
    }
  }

  return readNullableString(onboardingData.mission_goals) ?? readNullableString(onboardingData.mission) ?? 'to be defined';
}

function buildDefaultKnowledgeFiles(params: {
  tenantName: string;
  onboardingData: JsonRecord | null;
}): Record<KnowledgeFileKey, string> {
  const safeTenantName = params.tenantName.trim() || 'Company';
  const website = readCompanyWebsite(params.onboardingData) ?? 'to be defined';
  const mission = readMissionGoals(params.onboardingData);

  return {
    'knowledge/company-overview.md': [
      '# Company Overview',
      '',
      `- Company: ${safeTenantName}`,
      `- Website: ${website}`,
      `- Mission: ${mission}`,
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

export function parseKnowledgeMirror(
  onboardingData: unknown,
  tenantName: string,
): KnowledgeMirrorState {
  const root = isRecord(onboardingData) ? onboardingData : null;
  const mirror = root && isRecord(root.knowledge_mirror) ? root.knowledge_mirror : null;
  const mirrorFiles = mirror && isRecord(mirror.files) ? mirror.files : null;
  const mirrorSync = mirror && isRecord(mirror.sync) ? mirror.sync : null;
  const defaults = buildDefaultKnowledgeFiles({
    tenantName,
    onboardingData: root,
  });

  const files = { ...defaults };
  for (const key of KNOWLEDGE_FILE_KEYS) {
    const candidate = mirrorFiles ? mirrorFiles[key] : null;
    if (typeof candidate === 'string') {
      files[key] = candidate;
    }
  }

  const revision = readPositiveInt(mirror?.revision) ?? 1;
  const syncedRevision = readPositiveInt(mirrorSync?.synced_revision);
  const status = readSyncStatus(mirrorSync?.status) ?? 'pending';
  const effectiveStatus: KnowledgeSyncStatus =
    status === 'synced' && syncedRevision !== revision ? 'pending' : status;

  return {
    revision,
    files,
    sync: {
      status: effectiveStatus,
      revision,
      synced_revision: syncedRevision,
      seeded_revision: readPositiveInt(mirrorSync?.seeded_revision),
      last_synced_at: readNullableString(mirrorSync?.last_synced_at),
      last_error: readNullableString(mirrorSync?.last_error),
      updated_at: readNullableString(mirrorSync?.updated_at),
    },
  };
}

export function parseKnowledgeSyncSummary(raw: unknown): KnowledgeSyncSummary | null {
  if (!isRecord(raw)) {
    return null;
  }

  const status = readSyncStatus(raw.status);
  const revision = readPositiveInt(raw.revision);
  if (!status || !revision) {
    return null;
  }

  return {
    status,
    revision,
    synced_revision: readPositiveInt(raw.synced_revision),
    seeded_revision: readPositiveInt(raw.seeded_revision),
    last_synced_at: readNullableString(raw.last_synced_at),
    last_error: readNullableString(raw.last_error),
    updated_at: readNullableString(raw.updated_at),
  };
}

export function getKnowledgeSections(mirror: KnowledgeMirrorState): KnowledgeSection[] {
  return KNOWLEDGE_FILE_KEYS.map((key) => ({
    key,
    title: SECTION_TITLES[key],
    content: mirror.files[key],
  }));
}

export function getEffectiveKnowledgeSyncSummary(params: {
  statusSummary: KnowledgeSyncSummary | null;
  mirror: KnowledgeMirrorState;
}): KnowledgeSyncSummary {
  if (!params.statusSummary) {
    return params.mirror.sync;
  }

  if (params.statusSummary.revision < params.mirror.revision) {
    return {
      ...params.statusSummary,
      status: 'pending',
      revision: params.mirror.revision,
    };
  }

  return params.statusSummary;
}

