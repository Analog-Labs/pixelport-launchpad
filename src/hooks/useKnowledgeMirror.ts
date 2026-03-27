import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getEffectiveKnowledgeSyncSummary,
  getKnowledgeSections,
  parseKnowledgeMirror,
  parseKnowledgeSyncSummary,
  type KnowledgeFileKey,
  type KnowledgeMirrorState,
  type KnowledgeSection,
  type KnowledgeSyncSummary,
} from '@/lib/knowledge-mirror';

interface SaveKnowledgeInput {
  fileKey: KnowledgeFileKey;
  content: string;
  expectedRevision: number;
}

interface SaveKnowledgeResponse {
  success: boolean;
  onboarding_data?: Record<string, unknown>;
  knowledge_sync?: {
    queued?: boolean;
    revision?: number;
    reason?: string;
    error?: string;
  };
  error?: string;
}

interface RetryKnowledgeResponse extends SaveKnowledgeResponse {}

export class KnowledgeConflictError extends Error {
  readonly currentRevision: number;
  readonly expectedRevision: number;

  constructor(params: {
    expectedRevision: number;
    currentRevision: number;
    message: string;
  }) {
    super(params.message);
    this.name = 'KnowledgeConflictError';
    this.expectedRevision = params.expectedRevision;
    this.currentRevision = params.currentRevision;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized >= 1 ? normalized : null;
}

async function parseResponseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = await response.json();
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

async function fetchTenantStatus(accessToken: string): Promise<KnowledgeSyncSummary | null> {
  const response = await fetch('/api/tenants/status', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await parseResponseJson(response);
  if (!response.ok) {
    throw new Error(readNullableString(payload.error) ?? 'Failed to load knowledge sync status.');
  }

  return parseKnowledgeSyncSummary(payload.knowledge_sync);
}

export function useKnowledgeMirror() {
  const { session, tenant, tenantLoading, refreshTenant } = useAuth();
  const tenantId = tenant?.id ?? null;
  const accessToken = session?.access_token ?? '';
  const [shouldPollSync, setShouldPollSync] = useState(false);

  const mirror = useMemo<KnowledgeMirrorState>(() => {
    const tenantName = typeof tenant?.name === 'string' ? tenant.name : 'Company';
    return parseKnowledgeMirror(tenant?.onboarding_data, tenantName);
  }, [tenant?.name, tenant?.onboarding_data]);

  const statusQuery = useQuery<KnowledgeSyncSummary | null>({
    queryKey: ['tenant', tenantId, 'knowledge-sync-status'],
    queryFn: async () => fetchTenantStatus(accessToken),
    enabled: Boolean(accessToken && tenantId),
    refetchInterval: shouldPollSync ? 2500 : false,
    refetchOnWindowFocus: false,
  });

  const effectiveSync = getEffectiveKnowledgeSyncSummary({
    statusSummary: statusQuery.data ?? null,
    mirror,
  });

  useEffect(() => {
    if (effectiveSync.status === 'pending') {
      setShouldPollSync(true);
      return;
    }
    setShouldPollSync(false);
  }, [effectiveSync.status, effectiveSync.revision, effectiveSync.synced_revision]);

  const refresh = async () => {
    await refreshTenant();
    await statusQuery.refetch();
  };

  const saveMutation = useMutation({
    mutationFn: async (params: SaveKnowledgeInput): Promise<SaveKnowledgeResponse> => {
      const response = await fetch('/api/tenants/onboarding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          knowledge_mirror_expected_revision: params.expectedRevision,
          knowledge_mirror: {
            files: {
              [params.fileKey]: params.content,
            },
          },
        }),
      });
      const payload = await parseResponseJson(response);

      if (response.status === 409) {
        throw new KnowledgeConflictError({
          expectedRevision: readPositiveInt(payload.expected_revision) ?? params.expectedRevision,
          currentRevision: readPositiveInt(payload.current_revision) ?? params.expectedRevision,
          message: readNullableString(payload.error) ?? 'Knowledge mirror conflict. Refresh and retry.',
        });
      }

      if (!response.ok) {
        throw new Error(readNullableString(payload.error) ?? 'Failed to save knowledge section.');
      }

      return payload as SaveKnowledgeResponse;
    },
    onSuccess: async (payload) => {
      await refresh();
      if (payload.knowledge_sync?.queued === true) {
        setShouldPollSync(true);
      }
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (expectedRevision: number): Promise<RetryKnowledgeResponse> => {
      const response = await fetch('/api/tenants/onboarding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          force_knowledge_sync: true,
          knowledge_mirror_expected_revision: expectedRevision,
        }),
      });
      const payload = await parseResponseJson(response);

      if (response.status === 409) {
        throw new KnowledgeConflictError({
          expectedRevision,
          currentRevision: readPositiveInt(payload.current_revision) ?? expectedRevision,
          message: readNullableString(payload.error) ?? 'Knowledge mirror conflict. Refresh and retry.',
        });
      }

      if (!response.ok) {
        throw new Error(readNullableString(payload.error) ?? 'Failed to retry knowledge sync.');
      }

      return payload as RetryKnowledgeResponse;
    },
    onSuccess: async (payload) => {
      await refresh();
      if (payload.knowledge_sync?.queued === true) {
        setShouldPollSync(true);
      }
    },
  });

  const sections: KnowledgeSection[] = useMemo(() => getKnowledgeSections(mirror), [mirror]);

  return {
    tenantLoading,
    mirror,
    sections,
    syncSummary: effectiveSync,
    statusQuery,
    saveSection: saveMutation.mutateAsync,
    retrySync: retryMutation.mutateAsync,
    saveMutation,
    retryMutation,
    refresh,
  };
}
