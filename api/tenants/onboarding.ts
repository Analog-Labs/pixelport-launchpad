import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Inngest } from 'inngest';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { buildOnboardingData } from '../lib/onboarding-schema';
import {
  KNOWLEDGE_SYNC_REQUESTED_EVENT,
  markKnowledgeMirrorPending,
  markKnowledgeMirrorSyncFailed,
  withKnowledgeMirror,
} from '../lib/knowledge-mirror';
import { isTenantProvisioningComplete } from '../lib/tenant-status';

type JsonRecord = Record<string, unknown>;

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized >= 1 ? normalized : null;
}

function parseKnowledgeSyncControls(patch: JsonRecord): {
  expectedRevision: number | null;
  forceSync: boolean;
  error?: string;
} {
  const rawExpected = patch.knowledge_mirror_expected_revision;
  if (rawExpected !== undefined) {
    const expectedRevision = readPositiveInt(rawExpected);
    if (expectedRevision === null) {
      return {
        expectedRevision: null,
        forceSync: false,
        error: 'knowledge_mirror_expected_revision must be a positive integer when provided',
      };
    }
    if (patch.force_knowledge_sync !== undefined && typeof patch.force_knowledge_sync !== 'boolean') {
      return {
        expectedRevision: null,
        forceSync: false,
        error: 'force_knowledge_sync must be a boolean when provided',
      };
    }
    return {
      expectedRevision,
      forceSync: patch.force_knowledge_sync === true,
    };
  }

  if (patch.force_knowledge_sync !== undefined && typeof patch.force_knowledge_sync !== 'boolean') {
    return {
      expectedRevision: null,
      forceSync: false,
      error: 'force_knowledge_sync must be a boolean when provided',
    };
  }

  return {
    expectedRevision: null,
    forceSync: patch.force_knowledge_sync === true,
  };
}

function readKnowledgeMirrorRevision(onboardingData: unknown): number {
  if (!isRecord(onboardingData) || !isRecord(onboardingData.knowledge_mirror)) {
    return 1;
  }

  const revision = readPositiveInt(onboardingData.knowledge_mirror.revision);
  return revision ?? 1;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRuntimeReadyForMirrorSync(params: { status: string | null | undefined; dropletIp: string | null | undefined }): boolean {
  const runtimeReady = isTenantProvisioningComplete(params.status);
  const hasDropletIp = typeof params.dropletIp === 'string' && params.dropletIp.trim().length > 0;
  return runtimeReady && hasDropletIp;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const patch = req.body;

    if (!isRecord(patch)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const controls = parseKnowledgeSyncControls(patch);
    if (controls.error) {
      return res.status(400).json({ error: controls.error });
    }

    const currentRevision = readKnowledgeMirrorRevision(tenant.onboarding_data);
    if (controls.expectedRevision !== null && controls.expectedRevision !== currentRevision) {
      return res.status(409).json({
        error: 'Knowledge mirror revision conflict. Refresh data and retry your save.',
        code: 'knowledge_conflict',
        expected_revision: controls.expectedRevision,
        current_revision: currentRevision,
      });
    }

    const runtimeReadyForMirrorSync = isRuntimeReadyForMirrorSync({
      status: tenant.status,
      dropletIp: tenant.droplet_ip,
    });

    const normalized = buildOnboardingData(tenant.onboarding_data, patch);
    if (!normalized.ok) {
      return res.status(400).json({ error: `Invalid onboarding payload: ${normalized.error}` });
    }

    const shouldQueueKnowledgeSync =
      runtimeReadyForMirrorSync &&
      (normalized.knowledgeMirrorEdited || controls.forceSync);
    const shouldEnforceKnowledgeRevisionGuard =
      controls.expectedRevision !== null || controls.forceSync || normalized.knowledgeMirrorEdited;

    const mirrorForQueue =
      shouldQueueKnowledgeSync && controls.forceSync && !normalized.knowledgeMirrorEdited
        ? markKnowledgeMirrorPending({
          mirror: normalized.knowledgeMirror,
          clearError: true,
        })
        : normalized.knowledgeMirror;
    const onboardingDataToPersist =
      mirrorForQueue === normalized.knowledgeMirror
        ? normalized.onboardingData
        : withKnowledgeMirror(normalized.onboardingData, mirrorForQueue);

    const baseUpdateQuery = supabase
      .from('tenants')
      .update({ onboarding_data: onboardingDataToPersist })
      .eq('id', tenant.id);
    const guardedUpdateQuery =
      shouldEnforceKnowledgeRevisionGuard && typeof tenant.updated_at === 'string'
        ? baseUpdateQuery.eq('updated_at', tenant.updated_at)
        : baseUpdateQuery;

    const { data, error } = await guardedUpdateQuery
      .select('onboarding_data, updated_at')
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save onboarding data' });
    }

    if (!data) {
      if (shouldEnforceKnowledgeRevisionGuard) {
        const { data: latestTenant } = await supabase
          .from('tenants')
          .select('onboarding_data')
          .eq('id', tenant.id)
          .maybeSingle();
        const latestRevision = readKnowledgeMirrorRevision(latestTenant?.onboarding_data);

        return res.status(409).json({
          error: 'Knowledge mirror revision conflict. Refresh data and retry your save.',
          code: 'knowledge_conflict',
          expected_revision: controls.expectedRevision ?? currentRevision,
          current_revision: latestRevision,
        });
      }

      return res.status(404).json({ error: 'Tenant not found' });
    }

    const savedOnboardingData = (isRecord(data?.onboarding_data) ? data?.onboarding_data : onboardingDataToPersist) as JsonRecord;

    if (!shouldQueueKnowledgeSync) {
      return res.status(200).json({
        success: true,
        onboarding_data: savedOnboardingData,
        knowledge_sync: controls.forceSync
          ? {
            queued: false,
            revision: mirrorForQueue.revision,
            reason: runtimeReadyForMirrorSync ? 'no_changes_detected' : 'runtime_not_ready',
          }
          : undefined,
      });
    }

    try {
      await inngest.send({
        name: KNOWLEDGE_SYNC_REQUESTED_EVENT,
        data: {
          tenantId: tenant.id,
          revision: mirrorForQueue.revision,
        },
      });

      return res.status(200).json({
        success: true,
        onboarding_data: savedOnboardingData,
        knowledge_sync: {
          queued: true,
          revision: mirrorForQueue.revision,
        },
      });
    } catch (inngestError) {
      const enqueueError = `Knowledge sync enqueue failed: ${toErrorMessage(inngestError)}`;
      const failedMirror = markKnowledgeMirrorSyncFailed({
        mirror: mirrorForQueue,
        error: enqueueError,
      });
      const failedOnboardingData = withKnowledgeMirror(savedOnboardingData, failedMirror);
      const { data: failedData, error: failedUpdateError } = await supabase
        .from('tenants')
        .update({ onboarding_data: failedOnboardingData })
        .eq('id', tenant.id)
        .select('onboarding_data')
        .maybeSingle();

      if (failedUpdateError) {
        console.error('Failed to persist knowledge sync enqueue failure state:', failedUpdateError);
        return res.status(503).json({
          error: 'Saved onboarding changes, but failed to queue knowledge sync and could not persist failure state.',
        });
      }

      return res.status(200).json({
        success: true,
        onboarding_data: isRecord(failedData?.onboarding_data) ? failedData.onboarding_data : failedOnboardingData,
        knowledge_sync: {
          queued: false,
          revision: failedMirror.revision,
          error: enqueueError,
        },
      });
    }
  } catch (error) {
    return errorResponse(res, error);
  }
}
