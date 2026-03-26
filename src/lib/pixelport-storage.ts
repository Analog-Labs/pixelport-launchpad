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
  "pixelport_active_vault_refresh_commands",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readActiveVaultRefreshCommands(storage: Storage): Record<string, string> {
  const raw = storage.getItem("pixelport_active_vault_refresh_commands");
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => typeof key === "string" && typeof value === "string" && value.trim().length > 0
      )
    );
  } catch {
    return {};
  }
}

function writeActiveVaultRefreshCommands(storage: Storage, commands: Record<string, string>): void {
  storage.setItem("pixelport_active_vault_refresh_commands", JSON.stringify(commands));
}

function getVaultRefreshStorageKey(tenantId: string, sectionKey: string): string {
  return `${tenantId}:${sectionKey}`;
}

function isTenantVaultRefreshStorageKey(key: string, tenantId: string): boolean {
  return key.startsWith(`${tenantId}:`);
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
  const nested = isRecord(onboardingData.v2) ? onboardingData.v2 : null;
  const nestedCompany = nested && isRecord(nested.company) ? nested.company : null;

  const agentName =
    readString(onboardingData.agent_name) ??
    readString(nestedCompany?.chief_name) ??
    "Chief";
  const agentAvatar =
    readString(onboardingData.agent_avatar_id) ??
    readString(onboardingData.agent_avatar_url) ??
    readString(nestedCompany?.avatar_id) ??
    "amber-command";
  const companyUrl =
    readString(onboardingData.company_url) ??
    readString(nestedCompany?.website) ??
    "";
  const agentTone =
    readString(onboardingData.agent_tone) ??
    readString(nestedCompany?.tone) ??
    "strategic";

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

export function getStoredVaultRefreshCommandId(tenantId: string, sectionKey: string): string | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const commands = readActiveVaultRefreshCommands(storage);
  return commands[getVaultRefreshStorageKey(tenantId, sectionKey)] ?? null;
}

export function setStoredVaultRefreshCommandId(tenantId: string, sectionKey: string, commandId: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const commands = readActiveVaultRefreshCommands(storage);
  for (const key of Object.keys(commands)) {
    if (isTenantVaultRefreshStorageKey(key, tenantId)) {
      delete commands[key];
    }
  }
  commands[getVaultRefreshStorageKey(tenantId, sectionKey)] = commandId;
  writeActiveVaultRefreshCommands(storage, commands);
}

export function clearStoredVaultRefreshCommandId(tenantId: string, sectionKey: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const commands = readActiveVaultRefreshCommands(storage);
  delete commands[getVaultRefreshStorageKey(tenantId, sectionKey)];
  writeActiveVaultRefreshCommands(storage, commands);
}

export function clearStoredVaultRefreshCommandsForTenant(tenantId: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const commands = readActiveVaultRefreshCommands(storage);
  for (const key of Object.keys(commands)) {
    if (isTenantVaultRefreshStorageKey(key, tenantId)) {
      delete commands[key];
    }
  }
  writeActiveVaultRefreshCommands(storage, commands);
}
