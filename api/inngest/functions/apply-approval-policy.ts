import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { sshExec } from '../../lib/droplet-ssh';
import {
  APPROVAL_POLICY_APPLY_REQUESTED_EVENT,
  buildAtomicApprovalPolicyApplyScript,
  markApprovalPolicyApplied,
  markApprovalPolicyApplyFailed,
  normalizeApprovalPolicyRuntimeState,
  readApprovalPolicyFromOnboardingData,
  setLatestApprovalPolicyAuditOutcome,
  withApprovalPolicyRuntime,
  type ApprovalPolicyRuntimeState,
} from '../../lib/approval-policy-runtime';
import { isTenantProvisioningComplete } from '../../lib/tenant-status';

const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type JsonRecord = Record<string, unknown>;

type EventData = {
  tenantId?: string;
  revision?: number;
};

type TenantRow = {
  id: string;
  name: string;
  status: string;
  droplet_ip: string | null;
  onboarding_data: JsonRecord | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getSupabaseClient() {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function loadTenant(params: {
  supabase: ReturnType<typeof createClient>;
  tenantId: string;
}): Promise<TenantRow> {
  const { data, error } = await params.supabase
    .from('tenants')
    .select('id, name, status, droplet_ip, onboarding_data')
    .eq('id', params.tenantId)
    .single();

  if (error || !data) {
    throw new Error(`Tenant not found: ${params.tenantId}`);
  }

  return data as TenantRow;
}

async function persistPolicyRuntime(params: {
  supabase: ReturnType<typeof createClient>;
  tenantId: string;
  onboardingData: JsonRecord;
  runtime: ApprovalPolicyRuntimeState;
}): Promise<void> {
  const nextOnboardingData = withApprovalPolicyRuntime(params.onboardingData, params.runtime);
  const { error } = await params.supabase
    .from('tenants')
    .update({ onboarding_data: nextOnboardingData })
    .eq('id', params.tenantId);

  if (error) {
    throw new Error(`Failed to persist approval policy runtime state: ${error.message}`);
  }
}

export const applyApprovalPolicy = inngest.createFunction(
  {
    id: 'apply-approval-policy',
    name: 'Apply approval policy to tenant runtime files',
    retries: 2,
  },
  { event: APPROVAL_POLICY_APPLY_REQUESTED_EVENT },
  async ({ event, step }) => {
    const { tenantId, revision } = (event.data || {}) as EventData;
    if (!tenantId || typeof revision !== 'number' || !Number.isFinite(revision)) {
      throw new Error('Missing tenantId or revision in event payload');
    }

    const supabase = getSupabaseClient();
    const tenant = await step.run('load-tenant', async () => {
      return await loadTenant({ supabase, tenantId });
    });

    const onboardingData = isRecord(tenant.onboarding_data) ? tenant.onboarding_data : {};
    const runtime = normalizeApprovalPolicyRuntimeState({
      raw: onboardingData.approval_policy_runtime,
    });

    if (revision < runtime.revision) {
      return {
        success: true,
        skipped: true,
        reason: 'stale_revision',
        tenantId,
        eventRevision: revision,
        currentRevision: runtime.revision,
      };
    }

    if (revision > runtime.revision) {
      return {
        success: true,
        skipped: true,
        reason: 'future_revision',
        tenantId,
        eventRevision: revision,
        currentRevision: runtime.revision,
      };
    }

    const policy = readApprovalPolicyFromOnboardingData(onboardingData);

    try {
      if (!isTenantProvisioningComplete(tenant.status) || !tenant.droplet_ip) {
        throw new Error(
          `Runtime host unavailable for approval policy apply (status=${tenant.status || 'unknown'}, ` +
          `droplet_ip=${tenant.droplet_ip || 'missing'})`,
        );
      }

      const script = buildAtomicApprovalPolicyApplyScript({
        policy,
        revision,
      });

      await step.run('apply-policy-to-runtime', async () => {
        return await sshExec(tenant.droplet_ip as string, script);
      });
    } catch (error) {
      const failureReason =
        `Approval policy apply failed for revision ${revision}: ${toErrorMessage(error)}`;

      await step.run('persist-apply-failure', async () => {
        const latest = await loadTenant({ supabase, tenantId });
        const latestOnboardingData = isRecord(latest.onboarding_data) ? latest.onboarding_data : {};
        const latestRuntime = normalizeApprovalPolicyRuntimeState({
          raw: latestOnboardingData.approval_policy_runtime,
        });

        if (latestRuntime.revision !== revision) {
          return;
        }

        let failedRuntime = markApprovalPolicyApplyFailed({
          runtime: latestRuntime,
          error: failureReason,
        });
        failedRuntime = setLatestApprovalPolicyAuditOutcome({
          runtime: failedRuntime,
          outcome: 'failed',
          error: failureReason,
        });

        await persistPolicyRuntime({
          supabase,
          tenantId,
          onboardingData: latestOnboardingData,
          runtime: failedRuntime,
        });
      });

      throw new Error(failureReason);
    }

    return await step.run('persist-apply-success', async () => {
      const latest = await loadTenant({ supabase, tenantId });
      const latestOnboardingData = isRecord(latest.onboarding_data) ? latest.onboarding_data : {};
      const latestRuntime = normalizeApprovalPolicyRuntimeState({
        raw: latestOnboardingData.approval_policy_runtime,
      });

      if (latestRuntime.revision !== revision) {
        return {
          success: true,
          skipped: true,
          reason: 'stale_after_apply',
          tenantId,
          eventRevision: revision,
          currentRevision: latestRuntime.revision,
        };
      }

      let appliedRuntime = markApprovalPolicyApplied({
        runtime: latestRuntime,
        appliedRevision: revision,
      });
      appliedRuntime = setLatestApprovalPolicyAuditOutcome({
        runtime: appliedRuntime,
        outcome: 'applied',
        error: null,
      });

      await persistPolicyRuntime({
        supabase,
        tenantId,
        onboardingData: latestOnboardingData,
        runtime: appliedRuntime,
      });

      return {
        success: true,
        skipped: false,
        tenantId,
        revision,
      };
    });
  },
);
