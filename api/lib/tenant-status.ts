export const TENANT_STATUS = {
  DRAFT: "draft",
  PROVISIONING: "provisioning",
  ACTIVE: "active",
  READY: "ready",
} as const;

export function normalizeTenantStatus(status: unknown): string {
  if (typeof status !== "string") {
    return "";
  }
  return status.trim().toLowerCase();
}

export function isTenantProvisioningInFlight(status: unknown): boolean {
  return normalizeTenantStatus(status) === TENANT_STATUS.PROVISIONING;
}

export function isTenantProvisioningComplete(status: unknown): boolean {
  const normalized = normalizeTenantStatus(status);
  return normalized === TENANT_STATUS.ACTIVE || normalized === TENANT_STATUS.READY;
}

export function isTenantDraft(status: unknown): boolean {
  return normalizeTenantStatus(status) === TENANT_STATUS.DRAFT;
}
