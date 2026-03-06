const PIXELPORT_STORAGE_KEYS = [
  "pixelport_user_id",
  "pixelport_onboarded",
  "pixelport_agent_name",
  "pixelport_agent_avatar",
  "pixelport_company_name",
  "pixelport_company_url",
  "pixelport_agent_tone",
  "pixelport_tenant_id",
  "pixelport_tenant_status",
] as const;

type TenantLike = {
  id: string;
  name: string;
  status: string;
  onboarding_data?: Record<string, unknown> | null;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function clearPixelportSessionState(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  for (const key of PIXELPORT_STORAGE_KEYS) {
    storage.removeItem(key);
  }
}

export function getStoredPixelportUserId(): string | null {
  return getStorage()?.getItem("pixelport_user_id") ?? null;
}

export function hydratePixelportTenantState(userId: string, tenant: TenantLike): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const onboardingData = tenant.onboarding_data ?? {};
  const agentName = readString(onboardingData.agent_name) ?? "Luna";
  const agentAvatar = readString(onboardingData.agent_avatar_url) ?? "amber-l";
  const companyUrl = readString(onboardingData.company_url) ?? "";
  const agentTone = readString(onboardingData.agent_tone) ?? "professional";

  storage.setItem("pixelport_user_id", userId);
  storage.setItem("pixelport_onboarded", "true");
  storage.setItem("pixelport_agent_name", agentName);
  storage.setItem("pixelport_agent_avatar", agentAvatar);
  storage.setItem("pixelport_company_name", tenant.name || "");
  storage.setItem("pixelport_company_url", companyUrl);
  storage.setItem("pixelport_agent_tone", agentTone);
  storage.setItem("pixelport_tenant_id", tenant.id);
  storage.setItem("pixelport_tenant_status", tenant.status);
}
