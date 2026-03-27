import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import {
  getBootstrapState,
  reconcileBootstrapState,
  type BootstrapDurableProgress,
} from '../lib/bootstrap-state';
import { classifyGatewayFailure } from '../lib/openclaw-bootstrap-guard';
import { tryRecoverProvisioningTenant } from '../lib/provisioning-recovery';
import { projectKnowledgeSyncSummary } from '../lib/knowledge-mirror';
import {
  THIN_BRIDGE_CONTRACT_VERSION,
  isTaskStepUnlocked,
  type TenantStatusBridgePayload,
} from '../lib/thin-bridge-contract';
import { isTenantProvisioningComplete } from '../lib/tenant-status';

type ProvisioningCheck = NonNullable<NonNullable<TenantStatusBridgePayload['provisioning_progress']>['checks']>[number];

type ProvisioningCheckDraft = {
  key: string;
  label: string;
  complete: boolean;
  detail: string;
  failed?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readLaunchStartedAt(onboardingData: unknown): string | null {
  if (!isRecord(onboardingData)) {
    return null;
  }

  const nestedLaunch =
    isRecord(onboardingData.v2) && isRecord(onboardingData.v2.launch)
      ? onboardingData.v2.launch
      : null;

  const nestedStartedAt = readString(nestedLaunch?.started_at).trim();
  if (nestedStartedAt) {
    return nestedStartedAt;
  }

  const flatStartedAt = readString(onboardingData.launch_started_at).trim();
  return flatStartedAt || null;
}

function emptyDurableProgress(): BootstrapDurableProgress {
  return {
    taskCount: 0,
    competitorCount: 0,
    totalVaultSectionCount: 0,
    readyVaultSectionCount: 0,
    agentUpdatedVaultCount: 0,
    kickoffIssueSeeded: false,
    kickoffApprovalSeeded: false,
    workspaceContractSeeded: false,
    latestAgentActivityAt: null,
    hasAgentOutput: false,
    durableComplete: false,
  };
}

function toCompletedStatus(
  check: ProvisioningCheckDraft,
  runningKey: string | null,
): ProvisioningCheck['status'] {
  if (check.failed) {
    return 'failed';
  }

  if (check.complete) {
    return 'completed';
  }

  if (runningKey === check.key) {
    return 'running';
  }

  return 'pending';
}

function buildProvisioningProgress(params: {
  tenantStatus: string | null;
  bootstrapStatus: string | null;
  bootstrapErrorMessage: string | null;
  launchStartedAt: string | null;
  hasAgentOutput: boolean;
  hasDroplet: boolean;
  hasGateway: boolean;
  durableProgress: BootstrapDurableProgress;
}): NonNullable<TenantStatusBridgePayload['provisioning_progress']> {
  const normalizedStatus = typeof params.tenantStatus === 'string' ? params.tenantStatus.trim().toLowerCase() : '';
  const normalizedBootstrapStatus =
    typeof params.bootstrapStatus === 'string' ? params.bootstrapStatus.trim().toLowerCase() : '';

  const tenantReady = isTenantProvisioningComplete(normalizedStatus);
  const provisioningStarted = normalizedStatus === 'provisioning' || tenantReady;
  const launchRecorded = !!params.launchStartedAt || provisioningStarted;
  const bootstrapDispatchStarted = ['dispatching', 'accepted', 'completed', 'failed'].includes(
    normalizedBootstrapStatus,
  );
  const bootstrapAcknowledged = ['accepted', 'completed'].includes(normalizedBootstrapStatus) || tenantReady;
  const bootstrapFailed = normalizedBootstrapStatus === 'failed';
  const kickoffSeedCreated =
    (params.durableProgress.kickoffIssueSeeded && params.durableProgress.kickoffApprovalSeeded) || tenantReady;

  const drafts: ProvisioningCheckDraft[] = [
    {
      key: 'launch_request_recorded',
      label: 'Launch request recorded',
      complete: launchRecorded,
      detail: launchRecorded ? 'Launch trigger accepted.' : 'Waiting for launch trigger.',
    },
    {
      key: 'tenant_marked_provisioning',
      label: 'Tenant moved to provisioning',
      complete: provisioningStarted,
      detail: provisioningStarted
        ? 'Tenant status is provisioning.'
        : 'Waiting for draft to transition to provisioning.',
    },
    {
      key: 'bootstrap_dispatch_started',
      label: 'Bootstrap dispatch started',
      complete: bootstrapDispatchStarted || tenantReady,
      detail: bootstrapDispatchStarted || tenantReady
        ? 'Provisioning dispatcher is active.'
        : 'Waiting for bootstrap dispatch.',
    },
    {
      key: 'bootstrap_acknowledged',
      label: 'Bootstrap acknowledged',
      complete: bootstrapAcknowledged,
      detail: bootstrapAcknowledged
        ? 'Bootstrap acknowledged by runtime.'
        : bootstrapFailed
        ? params.bootstrapErrorMessage || 'Bootstrap failed before acknowledgment.'
        : 'Waiting for bootstrap acknowledgment.',
      failed: bootstrapFailed && !bootstrapAcknowledged,
    },
    {
      key: 'droplet_allocated',
      label: 'Droplet allocated',
      complete: params.hasDroplet || tenantReady,
      detail: params.hasDroplet || tenantReady
        ? 'Compute droplet is assigned.'
        : 'Waiting for droplet allocation.',
    },
    {
      key: 'gateway_credentials_ready',
      label: 'Gateway credentials ready',
      complete: params.hasGateway || tenantReady,
      detail: params.hasGateway || tenantReady
        ? 'Gateway token is present.'
        : 'Waiting for gateway credentials.',
    },
    {
      key: 'workspace_contract_seeded',
      label: 'Workspace contract seeded',
      complete: params.durableProgress.workspaceContractSeeded || tenantReady,
      detail: params.durableProgress.workspaceContractSeeded || tenantReady
        ? 'Workspace contract artifacts were written.'
        : 'Waiting for workspace contract seed.',
    },
    {
      key: 'kickoff_seed_created',
      label: 'Kickoff issue and approval seeded',
      complete: kickoffSeedCreated,
      detail: kickoffSeedCreated
        ? 'Kickoff issue and approval records exist.'
        : 'Waiting for kickoff seed records.',
    },
    {
      key: 'initial_agent_output_detected',
      label: 'Initial agent output detected',
      complete: params.hasAgentOutput || tenantReady,
      detail: params.hasAgentOutput || tenantReady
        ? 'Runtime has produced initial output.'
        : 'Waiting for first durable agent output.',
    },
    {
      key: 'vault_sections_seeded',
      label: 'Knowledge sections seeded',
      complete: params.durableProgress.totalVaultSectionCount > 0 || tenantReady,
      detail:
        params.durableProgress.totalVaultSectionCount > 0 || tenantReady
          ? `${params.durableProgress.totalVaultSectionCount} section(s) created.`
          : 'Waiting for initial knowledge sections.',
    },
    {
      key: 'vault_sections_ready',
      label: 'Knowledge sections marked ready',
      complete: params.durableProgress.readyVaultSectionCount > 0 || tenantReady,
      detail:
        params.durableProgress.readyVaultSectionCount > 0 || tenantReady
          ? `${params.durableProgress.readyVaultSectionCount} section(s) ready.`
          : 'Waiting for first ready knowledge section.',
    },
    {
      key: 'tenant_ready',
      label: 'Tenant ready',
      complete: tenantReady,
      detail: tenantReady
        ? 'Tenant status is active/ready.'
        : 'Waiting for final active/ready status.',
    },
  ];

  const failedCheck = drafts.find((check) => check.failed);
  const runningCheck = failedCheck
    ? null
    : drafts.find((check) => !check.complete);
  const runningKey = runningCheck ? runningCheck.key : null;

  const checks: ProvisioningCheck[] = drafts.map((check) => ({
    key: check.key,
    label: check.label,
    status: toCompletedStatus(check, runningKey),
    detail: check.detail,
  }));

  const completedChecks = checks.filter((check) => check.status === 'completed').length;

  return {
    total_checks: checks.length,
    completed_checks: completedChecks,
    current_check_key: failedCheck ? failedCheck.key : runningKey,
    checks,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tenant } = await authenticateRequest(req);
    const recovery = await tryRecoverProvisioningTenant(tenant);
    const effectiveTenant = recovery.tenant;

    const tenantStatus = typeof effectiveTenant.status === 'string' ? effectiveTenant.status : null;
    const fallbackBootstrapState = getBootstrapState(effectiveTenant.onboarding_data);
    let bootstrapStatus: string | null = fallbackBootstrapState.status;
    let bootstrapLastError: string | null = fallbackBootstrapState.last_error;
    let hasAgentOutput = false;
    let durableProgress = emptyDurableProgress();

    try {
      const bootstrap = await reconcileBootstrapState({
        tenantId: effectiveTenant.id,
        fallbackOnboardingData: effectiveTenant.onboarding_data,
      });
      bootstrapStatus = bootstrap.effectiveState.status ?? null;
      bootstrapLastError = bootstrap.effectiveState.last_error;
      hasAgentOutput = bootstrap.progress.hasAgentOutput;
      durableProgress = bootstrap.progress;
    } catch (error) {
      console.warn(
        `[tenants/status] reconcileBootstrapState failed for tenant ${effectiveTenant.id}; ` +
          `using fallback bootstrap state=${fallbackBootstrapState.status}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const bootstrapError = typeof bootstrapLastError === 'string' && bootstrapLastError
      ? classifyGatewayFailure({
        message: bootstrapLastError,
      })
      : null;
    const taskStepUnlocked =
      isTaskStepUnlocked(tenantStatus) ||
      (typeof bootstrapStatus === 'string' && bootstrapStatus.trim().toLowerCase() === 'completed');
    const hasDroplet = !!effectiveTenant.droplet_id;
    const hasGateway = !!effectiveTenant.gateway_token;
    const hasAgentmail = !!effectiveTenant.agentmail_inbox;
    const provisioningProgress = buildProvisioningProgress({
      tenantStatus,
      bootstrapStatus,
      bootstrapErrorMessage: bootstrapLastError,
      launchStartedAt: readLaunchStartedAt(effectiveTenant.onboarding_data),
      hasAgentOutput,
      hasDroplet,
      hasGateway,
      durableProgress,
    });

    const payload: TenantStatusBridgePayload = {
      contract_version: THIN_BRIDGE_CONTRACT_VERSION,
      status: tenantStatus,
      bootstrap_status: bootstrapStatus,
      knowledge_sync: projectKnowledgeSyncSummary(effectiveTenant.onboarding_data),
      provisioning_progress: provisioningProgress,
      bootstrap_error: bootstrapError
        ? {
          tag: bootstrapError.tag,
          retryable: bootstrapError.retryable,
          message: bootstrapError.message,
          missing_scope: bootstrapError.missingScope,
          request_id: bootstrapError.requestId,
        }
        : null,
      task_step_unlocked: taskStepUnlocked,
      has_agent_output: hasAgentOutput,
      has_droplet: hasDroplet,
      has_gateway: hasGateway,
      has_agentmail: hasAgentmail,
      trial_ends_at: effectiveTenant.trial_ends_at ?? null,
      plan: effectiveTenant.plan ?? null,
    };

    return res.status(200).json(payload);
  } catch (error) {
    return errorResponse(res, error);
  }
}
