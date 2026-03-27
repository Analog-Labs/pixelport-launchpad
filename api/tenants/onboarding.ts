import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Inngest } from 'inngest';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { buildOnboardingData } from '../lib/onboarding-schema';
import {
  KNOWLEDGE_SYNC_REQUESTED_EVENT,
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

    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const normalized = buildOnboardingData(tenant.onboarding_data, patch);
    if (!normalized.ok) {
      return res.status(400).json({ error: `Invalid onboarding payload: ${normalized.error}` });
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({ onboarding_data: normalized.onboardingData })
      .eq('id', tenant.id)
      .select('onboarding_data')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save onboarding data' });
    }

    const savedOnboardingData = (isRecord(data?.onboarding_data) ? data?.onboarding_data : normalized.onboardingData) as JsonRecord;
    const shouldQueueKnowledgeSync =
      normalized.knowledgeMirrorEdited &&
      isRuntimeReadyForMirrorSync({
        status: tenant.status,
        dropletIp: tenant.droplet_ip,
      });

    if (!shouldQueueKnowledgeSync) {
      return res.status(200).json({ success: true, onboarding_data: savedOnboardingData });
    }

    try {
      await inngest.send({
        name: KNOWLEDGE_SYNC_REQUESTED_EVENT,
        data: {
          tenantId: tenant.id,
          revision: normalized.knowledgeMirror.revision,
        },
      });

      return res.status(200).json({
        success: true,
        onboarding_data: savedOnboardingData,
        knowledge_sync: {
          queued: true,
          revision: normalized.knowledgeMirror.revision,
        },
      });
    } catch (inngestError) {
      const enqueueError = `Knowledge sync enqueue failed: ${toErrorMessage(inngestError)}`;
      const failedMirror = markKnowledgeMirrorSyncFailed({
        mirror: normalized.knowledgeMirror,
        error: enqueueError,
      });
      const failedOnboardingData = withKnowledgeMirror(savedOnboardingData, failedMirror);
      const { data: failedData, error: failedUpdateError } = await supabase
        .from('tenants')
        .update({ onboarding_data: failedOnboardingData })
        .eq('id', tenant.id)
        .select('onboarding_data')
        .single();

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
