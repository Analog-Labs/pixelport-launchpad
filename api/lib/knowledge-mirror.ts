import {
  WORKSPACE_KNOWLEDGE_FILES,
  buildWorkspaceKnowledgeFiles,
  type WorkspaceKnowledgeFilePath,
} from './workspace-contract';

type JsonRecord = Record<string, unknown>;

export const KNOWLEDGE_SYNC_REQUESTED_EVENT = 'pixelport/knowledge.sync.requested';
export const KNOWLEDGE_WORKSPACE_HOST_DIR = '/opt/openclaw/workspace-main/knowledge';

export const KNOWLEDGE_SYNC_STATUS_VALUES = ['pending', 'synced', 'failed'] as const;
export type KnowledgeSyncStatus = (typeof KNOWLEDGE_SYNC_STATUS_VALUES)[number];

export type KnowledgeMirrorFiles = Record<WorkspaceKnowledgeFilePath, string>;
export type KnowledgeMirrorFilePatch = Partial<Record<WorkspaceKnowledgeFilePath, string>>;

export interface KnowledgeMirrorSyncState {
  status: KnowledgeSyncStatus;
  synced_revision: number | null;
  seeded_revision: number | null;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string | null;
}

export interface KnowledgeMirrorState {
  revision: number;
  files: KnowledgeMirrorFiles;
  sync: KnowledgeMirrorSyncState;
}

export interface KnowledgeSyncSummary {
  status: KnowledgeSyncStatus;
  revision: number;
  synced_revision: number | null;
  seeded_revision: number | null;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : null;
}

function readTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readSyncStatus(value: unknown): KnowledgeSyncStatus | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return KNOWLEDGE_SYNC_STATUS_VALUES.includes(normalized as KnowledgeSyncStatus)
    ? (normalized as KnowledgeSyncStatus)
    : null;
}

function buildNormalizedMirrorFiles(params: {
  rawFiles: JsonRecord | null;
  defaultFiles: KnowledgeMirrorFiles;
}): KnowledgeMirrorFiles {
  const nextFiles = { ...params.defaultFiles };

  if (!params.rawFiles) {
    return nextFiles;
  }

  for (const filePath of WORKSPACE_KNOWLEDGE_FILES) {
    const rawValue = params.rawFiles[filePath];
    if (typeof rawValue === 'string') {
      nextFiles[filePath] = rawValue;
    }
  }

  return nextFiles;
}

export function normalizeKnowledgeMirror(params: {
  raw: unknown;
  tenantName: string;
  onboardingData: JsonRecord;
  now?: string;
}): KnowledgeMirrorState {
  const nowIso = params.now ?? new Date().toISOString();
  const defaultFiles = buildWorkspaceKnowledgeFiles({
    tenantName: params.tenantName,
    onboardingData: params.onboardingData,
  });
  const rawMirror = isRecord(params.raw) ? params.raw : {};
  const rawFiles = isRecord(rawMirror.files) ? rawMirror.files : null;
  const rawSync = isRecord(rawMirror.sync) ? rawMirror.sync : {};

  const revision = Math.max(1, readInt(rawMirror.revision) ?? 1);
  const syncedRevision = readInt(rawSync.synced_revision);
  const seededRevision = readInt(rawSync.seeded_revision);
  let status = readSyncStatus(rawSync.status) ?? 'pending';

  if (status === 'synced' && syncedRevision !== revision) {
    status = 'pending';
  }

  return {
    revision,
    files: buildNormalizedMirrorFiles({
      rawFiles,
      defaultFiles,
    }),
    sync: {
      status,
      synced_revision: syncedRevision,
      seeded_revision: seededRevision,
      last_synced_at: readTimestamp(rawSync.last_synced_at),
      last_error: readTimestamp(rawSync.last_error),
      updated_at: readTimestamp(rawSync.updated_at) ?? nowIso,
    },
  };
}

export function normalizeKnowledgeMirrorFilePatch(raw: unknown): KnowledgeMirrorFilePatch {
  if (!isRecord(raw)) {
    return {};
  }

  const patch: KnowledgeMirrorFilePatch = {};
  for (const filePath of WORKSPACE_KNOWLEDGE_FILES) {
    if (Object.prototype.hasOwnProperty.call(raw, filePath) && typeof raw[filePath] === 'string') {
      patch[filePath] = raw[filePath] as string;
    }
  }

  return patch;
}

export function applyKnowledgeMirrorFilePatch(params: {
  mirror: KnowledgeMirrorState;
  filesPatch: KnowledgeMirrorFilePatch;
  now?: string;
}): { mirror: KnowledgeMirrorState; edited: boolean } {
  const nextFiles = { ...params.mirror.files };
  let edited = false;

  for (const filePath of WORKSPACE_KNOWLEDGE_FILES) {
    if (!Object.prototype.hasOwnProperty.call(params.filesPatch, filePath)) {
      continue;
    }

    const nextValue = params.filesPatch[filePath];
    if (typeof nextValue !== 'string') {
      continue;
    }

    if (nextValue !== nextFiles[filePath]) {
      nextFiles[filePath] = nextValue;
      edited = true;
    }
  }

  if (!edited) {
    return { mirror: params.mirror, edited: false };
  }

  const nowIso = params.now ?? new Date().toISOString();
  const nextMirror: KnowledgeMirrorState = {
    revision: params.mirror.revision + 1,
    files: nextFiles,
    sync: {
      ...params.mirror.sync,
      status: 'pending',
      last_error: null,
      updated_at: nowIso,
    },
  };

  return {
    mirror: nextMirror,
    edited: true,
  };
}

export function markKnowledgeMirrorPending(params: {
  mirror: KnowledgeMirrorState;
  now?: string;
  clearError?: boolean;
}): KnowledgeMirrorState {
  const nowIso = params.now ?? new Date().toISOString();
  return {
    ...params.mirror,
    sync: {
      ...params.mirror.sync,
      status: 'pending',
      last_error: params.clearError ? null : params.mirror.sync.last_error,
      updated_at: nowIso,
    },
  };
}

export function markKnowledgeMirrorSynced(params: {
  mirror: KnowledgeMirrorState;
  syncedRevision?: number;
  now?: string;
}): KnowledgeMirrorState {
  const nowIso = params.now ?? new Date().toISOString();
  const syncedRevision = params.syncedRevision ?? params.mirror.revision;
  return {
    ...params.mirror,
    sync: {
      ...params.mirror.sync,
      status: 'synced',
      synced_revision: syncedRevision,
      last_synced_at: nowIso,
      last_error: null,
      updated_at: nowIso,
    },
  };
}

export function markKnowledgeMirrorSyncFailed(params: {
  mirror: KnowledgeMirrorState;
  error: string;
  now?: string;
}): KnowledgeMirrorState {
  const nowIso = params.now ?? new Date().toISOString();
  return {
    ...params.mirror,
    sync: {
      ...params.mirror.sync,
      status: 'failed',
      last_error: params.error,
      updated_at: nowIso,
    },
  };
}

export function markKnowledgeMirrorSeededRevision(params: {
  mirror: KnowledgeMirrorState;
  seededRevision: number;
  now?: string;
}): KnowledgeMirrorState {
  const nowIso = params.now ?? new Date().toISOString();
  return {
    ...params.mirror,
    sync: {
      ...params.mirror.sync,
      seeded_revision: params.seededRevision,
      updated_at: nowIso,
    },
  };
}

export function withKnowledgeMirror(onboardingData: JsonRecord, mirror: KnowledgeMirrorState): JsonRecord {
  return {
    ...onboardingData,
    knowledge_mirror: mirror as unknown as JsonRecord,
  };
}

export function projectKnowledgeSyncSummary(onboardingData: unknown): KnowledgeSyncSummary | null {
  if (!isRecord(onboardingData) || !isRecord(onboardingData.knowledge_mirror)) {
    return null;
  }

  const mirror = onboardingData.knowledge_mirror;
  const revision = Math.max(1, readInt(mirror.revision) ?? 1);
  const sync = isRecord(mirror.sync) ? mirror.sync : {};
  const status = readSyncStatus(sync.status) ?? 'pending';

  return {
    status,
    revision,
    synced_revision: readInt(sync.synced_revision),
    seeded_revision: readInt(sync.seeded_revision),
    last_synced_at: readTimestamp(sync.last_synced_at),
    last_error: readTimestamp(sync.last_error),
    updated_at: readTimestamp(sync.updated_at),
  };
}
