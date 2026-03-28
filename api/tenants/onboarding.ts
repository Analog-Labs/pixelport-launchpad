import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Inngest } from 'inngest';
import { sshExec } from '../lib/droplet-ssh';
import { authenticateRequest, errorResponse } from '../lib/auth';
import {
  APPROVAL_POLICY_APPLY_REQUESTED_EVENT,
  appendApprovalPolicyAuditEntry,
  approvalPoliciesEqual,
  buildAtomicApprovalPolicyApplyScript,
  createApprovalPolicyAuditEntry,
  markApprovalPolicyApplied,
  markApprovalPolicyApplyFailed,
  markApprovalPolicyPending,
  normalizeApprovalPolicyRuntimeState,
  readApprovalPolicyFromOnboardingData,
  readApprovalPolicyRevision,
  setLatestApprovalPolicyAuditOutcome,
  summarizeApprovalPolicyChanges,
  withApprovalPolicyRuntime,
  type ApprovalPolicyApplyStatus,
} from '../lib/approval-policy-runtime';
import { buildOnboardingData } from '../lib/onboarding-schema';
import {
  KNOWLEDGE_SYNC_REQUESTED_EVENT,
  markKnowledgeMirrorPending,
  markKnowledgeMirrorSyncFailed,
  withKnowledgeMirror,
} from '../lib/knowledge-mirror';
import { supabase } from '../lib/supabase';
import { isTenantProvisioningComplete } from '../lib/tenant-status';

type JsonRecord = Record<string, unknown>;

type KnowledgeSyncControls = {
  expectedRevision: number | null;
  forceSync: boolean;
  error?: string;
};

type PolicyApplyControls = {
  expectedRevision: number | null;
  forceApply: boolean;
  error?: string;
};

type KnowledgeSyncResponse = {
  queued: boolean;
  revision: number;
  reason?: string;
  error?: string;
};

type PolicyApplyResponse = {
  queued: boolean;
  revision: number;
  status: ApprovalPolicyApplyStatus;
  reason?: string;
  error?: string;
};

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

function parseKnowledgeSyncControls(patch: JsonRecord): KnowledgeSyncControls {
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

function parsePolicyApplyControls(patch: JsonRecord): PolicyApplyControls {
  const rawExpected = patch.approval_policy_expected_revision;
  if (rawExpected !== undefined) {
    const expectedRevision = readPositiveInt(rawExpected);
    if (expectedRevision === null) {
      return {
        expectedRevision: null,
        forceApply: false,
        error: 'approval_policy_expected_revision must be a positive integer when provided',
      };
    }

    if (patch.force_policy_apply !== undefined && typeof patch.force_policy_apply !== 'boolean') {
      return {
        expectedRevision: null,
        forceApply: false,
        error: 'force_policy_apply must be a boolean when provided',
      };
    }

    return {
      expectedRevision,
      forceApply: patch.force_policy_apply === true,
    };
  }

  if (patch.force_policy_apply !== undefined && typeof patch.force_policy_apply !== 'boolean') {
    return {
      expectedRevision: null,
      forceApply: false,
      error: 'force_policy_apply must be a boolean when provided',
    };
  }

  return {
    expectedRevision: null,
    forceApply: patch.force_policy_apply === true,
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

function isRuntimeReady(params: {
  status: string | null | undefined;
  dropletIp: string | null | undefined;
}): boolean {
  const runtimeReady = isTenantProvisioningComplete(params.status);
  const hasDropletIp = typeof params.dropletIp === 'string' && params.dropletIp.trim().length > 0;
  return runtimeReady && hasDropletIp;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant, userId } = await authenticateRequest(req);
    const patch = req.body;

    if (!isRecord(patch)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const knowledgeControls = parseKnowledgeSyncControls(patch);
    if (knowledgeControls.error) {
      return res.status(400).json({ error: knowledgeControls.error });
    }

    const policyControls = parsePolicyApplyControls(patch);
    if (policyControls.error) {
      return res.status(400).json({ error: policyControls.error });
    }

    const currentKnowledgeRevision = readKnowledgeMirrorRevision(tenant.onboarding_data);
    if (
      knowledgeControls.expectedRevision !== null &&
      knowledgeControls.expectedRevision !== currentKnowledgeRevision
    ) {
      return res.status(409).json({
        error: 'Knowledge mirror revision conflict. Refresh data and retry your save.',
        code: 'knowledge_conflict',
        expected_revision: knowledgeControls.expectedRevision,
        current_revision: currentKnowledgeRevision,
      });
    }

    const currentPolicyRevision = readApprovalPolicyRevision(tenant.onboarding_data);
    if (policyControls.expectedRevision !== null && policyControls.expectedRevision !== currentPolicyRevision) {
      return res.status(409).json({
        error: 'Approval policy revision conflict. Refresh data and retry your save.',
        code: 'approval_policy_conflict',
        expected_revision: policyControls.expectedRevision,
        current_revision: currentPolicyRevision,
      });
    }

    const runtimeReady = isRuntimeReady({
      status: tenant.status,
      dropletIp: tenant.droplet_ip,
    });

    const normalized = buildOnboardingData(tenant.onboarding_data, patch);
    if (!normalized.ok) {
      return res.status(400).json({ error: `Invalid onboarding payload: ${normalized.error}` });
    }

    const shouldQueueKnowledgeSync =
      runtimeReady &&
      (normalized.knowledgeMirrorEdited || knowledgeControls.forceSync);
    const shouldEnforceKnowledgeRevisionGuard =
      knowledgeControls.expectedRevision !== null ||
      knowledgeControls.forceSync ||
      normalized.knowledgeMirrorEdited;

    const mirrorForQueue =
      shouldQueueKnowledgeSync && knowledgeControls.forceSync && !normalized.knowledgeMirrorEdited
        ? markKnowledgeMirrorPending({
          mirror: normalized.knowledgeMirror,
          clearError: true,
        })
        : normalized.knowledgeMirror;

    const baseOnboardingData =
      mirrorForQueue === normalized.knowledgeMirror
        ? normalized.onboardingData
        : withKnowledgeMirror(normalized.onboardingData, mirrorForQueue);

    const existingOnboardingData = isRecord(tenant.onboarding_data) ? tenant.onboarding_data : {};
    const previousPolicy = readApprovalPolicyFromOnboardingData(existingOnboardingData);
    const nextPolicy = readApprovalPolicyFromOnboardingData(baseOnboardingData);
    const policyEdited = !approvalPoliciesEqual(previousPolicy, nextPolicy);
    const policyApplyRequested = policyEdited || policyControls.forceApply;
    const shouldEnforcePolicyRevisionGuard =
      policyControls.expectedRevision !== null || policyControls.forceApply || policyEdited;

    const nowIso = new Date().toISOString();
    let policyRuntime = normalizeApprovalPolicyRuntimeState({
      raw: existingOnboardingData.approval_policy_runtime,
      now: nowIso,
    });

    if (policyApplyRequested) {
      const nextRevision = policyEdited ? policyRuntime.revision + 1 : policyRuntime.revision;
      policyRuntime = markApprovalPolicyPending({
        runtime: policyRuntime,
        revision: nextRevision,
        clearError: true,
        now: nowIso,
      });
      policyRuntime = appendApprovalPolicyAuditEntry({
        runtime: policyRuntime,
        entry: createApprovalPolicyAuditEntry({
          revision: policyRuntime.revision,
          actor: userId,
          timestamp: nowIso,
          changeType: policyEdited ? 'policy_update' : 'retry',
          before: previousPolicy,
          after: nextPolicy,
          changedFields: summarizeApprovalPolicyChanges({
            before: previousPolicy,
            after: nextPolicy,
          }),
          applyOutcome: 'pending',
          applyError: null,
        }),
      });
    }

    let shouldQueuePolicyApply = false;
    let policyApplyResponse: PolicyApplyResponse | undefined;

    if (policyApplyRequested) {
      if (runtimeReady && tenant.droplet_ip) {
        try {
          const script = buildAtomicApprovalPolicyApplyScript({
            policy: nextPolicy,
            revision: policyRuntime.revision,
          });
          await sshExec(tenant.droplet_ip, script);
          policyRuntime = markApprovalPolicyApplied({
            runtime: policyRuntime,
            now: nowIso,
          });
          policyRuntime = setLatestApprovalPolicyAuditOutcome({
            runtime: policyRuntime,
            outcome: 'applied',
            error: null,
          });
          policyApplyResponse = {
            queued: false,
            revision: policyRuntime.revision,
            status: 'applied',
          };
        } catch (applyError) {
          const syncError =
            `Approval policy apply failed for revision ${policyRuntime.revision}: ` +
            toErrorMessage(applyError);
          policyRuntime = markApprovalPolicyApplyFailed({
            runtime: policyRuntime,
            error: syncError,
            now: nowIso,
          });
          policyRuntime = setLatestApprovalPolicyAuditOutcome({
            runtime: policyRuntime,
            outcome: 'failed',
            error: syncError,
          });
          shouldQueuePolicyApply = true;
          policyApplyResponse = {
            queued: true,
            revision: policyRuntime.revision,
            status: 'failed',
            error: syncError,
          };
        }
      } else {
        policyApplyResponse = {
          queued: false,
          revision: policyRuntime.revision,
          status: policyRuntime.apply.status,
          reason: 'runtime_not_ready',
        };
      }
    }

    const onboardingDataToPersist = withApprovalPolicyRuntime(baseOnboardingData, policyRuntime);

    const shouldEnforceRevisionGuard =
      shouldEnforceKnowledgeRevisionGuard || shouldEnforcePolicyRevisionGuard;
    const baseUpdateQuery = supabase
      .from('tenants')
      .update({ onboarding_data: onboardingDataToPersist })
      .eq('id', tenant.id);
    const guardedUpdateQuery =
      shouldEnforceRevisionGuard && typeof tenant.updated_at === 'string'
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
      if (shouldEnforceRevisionGuard) {
        const { data: latestTenant } = await supabase
          .from('tenants')
          .select('onboarding_data')
          .eq('id', tenant.id)
          .maybeSingle();
        const latestKnowledgeRevision = readKnowledgeMirrorRevision(latestTenant?.onboarding_data);
        const latestPolicyRevision = readApprovalPolicyRevision(latestTenant?.onboarding_data);

        if (
          policyControls.expectedRevision !== null &&
          policyControls.expectedRevision !== latestPolicyRevision
        ) {
          return res.status(409).json({
            error: 'Approval policy revision conflict. Refresh data and retry your save.',
            code: 'approval_policy_conflict',
            expected_revision: policyControls.expectedRevision,
            current_revision: latestPolicyRevision,
          });
        }

        if (shouldEnforcePolicyRevisionGuard && !shouldEnforceKnowledgeRevisionGuard) {
          return res.status(409).json({
            error: 'Approval policy revision conflict. Refresh data and retry your save.',
            code: 'approval_policy_conflict',
            expected_revision: policyControls.expectedRevision ?? currentPolicyRevision,
            current_revision: latestPolicyRevision,
          });
        }

        return res.status(409).json({
          error: 'Knowledge mirror revision conflict. Refresh data and retry your save.',
          code: 'knowledge_conflict',
          expected_revision: knowledgeControls.expectedRevision ?? currentKnowledgeRevision,
          current_revision: latestKnowledgeRevision,
        });
      }

      return res.status(404).json({ error: 'Tenant not found' });
    }

    let savedOnboardingData = (isRecord(data?.onboarding_data)
      ? data?.onboarding_data
      : onboardingDataToPersist) as JsonRecord;

    let knowledgeSyncResponse: KnowledgeSyncResponse | undefined;

    if (!shouldQueueKnowledgeSync) {
      knowledgeSyncResponse = knowledgeControls.forceSync
        ? {
          queued: false,
          revision: mirrorForQueue.revision,
          reason: runtimeReady ? 'no_changes_detected' : 'runtime_not_ready',
        }
        : undefined;
    } else {
      try {
        await inngest.send({
          name: KNOWLEDGE_SYNC_REQUESTED_EVENT,
          data: {
            tenantId: tenant.id,
            revision: mirrorForQueue.revision,
          },
        });

        knowledgeSyncResponse = {
          queued: true,
          revision: mirrorForQueue.revision,
        };
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

        savedOnboardingData = isRecord(failedData?.onboarding_data)
          ? failedData.onboarding_data
          : failedOnboardingData;

        knowledgeSyncResponse = {
          queued: false,
          revision: failedMirror.revision,
          error: enqueueError,
        };
      }
    }

    if (shouldQueuePolicyApply && policyApplyResponse) {
      try {
        await inngest.send({
          name: APPROVAL_POLICY_APPLY_REQUESTED_EVENT,
          data: {
            tenantId: tenant.id,
            revision: policyRuntime.revision,
          },
        });
      } catch (inngestError) {
        const enqueueError = `Approval policy apply enqueue failed: ${toErrorMessage(inngestError)}`;
        const savedRuntime = normalizeApprovalPolicyRuntimeState({
          raw: savedOnboardingData.approval_policy_runtime,
        });
        let failedRuntime = markApprovalPolicyApplyFailed({
          runtime: savedRuntime,
          error: enqueueError,
        });
        failedRuntime = setLatestApprovalPolicyAuditOutcome({
          runtime: failedRuntime,
          outcome: 'failed',
          error: enqueueError,
        });

        const failedOnboardingData = withApprovalPolicyRuntime(savedOnboardingData, failedRuntime);
        const { data: failedData, error: failedUpdateError } = await supabase
          .from('tenants')
          .update({ onboarding_data: failedOnboardingData })
          .eq('id', tenant.id)
          .select('onboarding_data')
          .maybeSingle();

        if (failedUpdateError) {
          console.error('Failed to persist approval policy enqueue failure state:', failedUpdateError);
          return res.status(503).json({
            error: 'Saved onboarding changes, but failed to queue approval policy apply and could not persist failure state.',
          });
        }

        savedOnboardingData = isRecord(failedData?.onboarding_data)
          ? failedData.onboarding_data
          : failedOnboardingData;

        policyApplyResponse = {
          queued: false,
          revision: failedRuntime.revision,
          status: failedRuntime.apply.status,
          error: enqueueError,
        };
      }
    }

    return res.status(200).json({
      success: true,
      onboarding_data: savedOnboardingData,
      knowledge_sync: knowledgeSyncResponse,
      policy_apply: policyApplyResponse,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
