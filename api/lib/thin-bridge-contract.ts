export const THIN_BRIDGE_CONTRACT_VERSION = 'pivot-p0-v2';

const TASK_UNLOCK_STATUSES = new Set(['ready', 'active']);

export function isTaskStepUnlocked(status: string | null | undefined): boolean {
  if (typeof status !== 'string') {
    return false;
  }

  return TASK_UNLOCK_STATUSES.has(status.trim().toLowerCase());
}

export interface TenantStatusBridgePayload {
  contract_version: string;
  status: string | null;
  bootstrap_status: string | null;
  provisioning_progress?: {
    total_checks: number;
    completed_checks: number;
    current_check_key: string | null;
    checks: Array<{
      key: string;
      label: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      detail?: string | null;
    }>;
  } | null;
  bootstrap_error?: {
    tag: string;
    retryable: boolean;
    message: string;
    missing_scope?: string | null;
    request_id?: string | null;
  } | null;
  knowledge_sync?: {
    status: 'pending' | 'synced' | 'failed';
    revision: number;
    synced_revision: number | null;
    seeded_revision: number | null;
    last_synced_at: string | null;
    last_error: string | null;
    updated_at: string | null;
  } | null;
  task_step_unlocked: boolean;
  has_agent_output: boolean;
  has_droplet: boolean;
  has_gateway: boolean;
  has_agentmail: boolean;
  trial_ends_at: string | null;
  plan: string | null;
}
