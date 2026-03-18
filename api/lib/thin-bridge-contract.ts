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
  task_step_unlocked: boolean;
  has_agent_output: boolean;
  has_droplet: boolean;
  has_gateway: boolean;
  has_agentmail: boolean;
  trial_ends_at: string | null;
  plan: string | null;
}
