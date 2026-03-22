export const THIN_BRIDGE_CONTRACT_VERSION = "pivot-p0-v2";

const TASK_UNLOCK_STATUSES = new Set(["ready", "active"]);
const BOOTSTRAP_UNLOCK_STATUSES = new Set(["completed"]);

export function isTaskStepUnlocked(status: string | null | undefined): boolean {
  if (typeof status !== "string") {
    return false;
  }

  return TASK_UNLOCK_STATUSES.has(status.trim().toLowerCase());
}

function isBootstrapStepUnlocked(bootstrapStatus: string | null | undefined): boolean {
  if (typeof bootstrapStatus !== "string") {
    return false;
  }

  return BOOTSTRAP_UNLOCK_STATUSES.has(bootstrapStatus.trim().toLowerCase());
}

export function resolveTaskStepUnlocked(params: {
  status: string | null | undefined;
  bootstrapStatus?: string | null | undefined;
  taskStepUnlocked?: boolean | null | undefined;
}): boolean {
  if (params.taskStepUnlocked === true) {
    return true;
  }

  if (isTaskStepUnlocked(params.status)) {
    return true;
  }

  return isBootstrapStepUnlocked(params.bootstrapStatus);
}

export interface TenantStatusResponse {
  contract_version?: string;
  status?: string | null;
  bootstrap_status?: string | null;
  task_step_unlocked?: boolean;
  error?: string;
}
