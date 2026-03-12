type JsonRecord = Record<string, unknown>;

export const DEFAULT_MEMORY_NATIVE_ENABLED = true;
export const DEFAULT_MEMORY_MEM0_ENABLED = false;
export const MEMORY_OPENAI_API_KEY_ENV = 'MEMORY_OPENAI_API_KEY';
export const OPENCLAW_MEMORY_OPENAI_API_KEY_REF = '${MEMORY_OPENAI_API_KEY}';

export type TenantMemorySettings = {
  nativeEnabled: boolean;
  mem0Enabled: boolean;
  rawSettings: JsonRecord;
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function parseBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  return fallback;
}

export function resolveTenantMemorySettings(settings: unknown): TenantMemorySettings {
  const rawSettings = asRecord(settings);

  return {
    nativeEnabled: parseBooleanSetting(
      rawSettings.memory_native_enabled,
      DEFAULT_MEMORY_NATIVE_ENABLED,
    ),
    mem0Enabled: parseBooleanSetting(
      rawSettings.memory_mem0_enabled,
      DEFAULT_MEMORY_MEM0_ENABLED,
    ),
    rawSettings,
  };
}

export function applyTenantMemorySettingsDefaults(settings: unknown): JsonRecord {
  const resolved = resolveTenantMemorySettings(settings);

  return {
    ...resolved.rawSettings,
    memory_native_enabled: resolved.nativeEnabled,
    memory_mem0_enabled: resolved.mem0Enabled,
  };
}

export function buildOpenClawMemorySearchConfig(nativeEnabled: boolean): JsonRecord {
  if (!nativeEnabled) {
    return {
      enabled: false,
    };
  }

  return {
    enabled: true,
    provider: 'openai',
    remote: {
      apiKey: OPENCLAW_MEMORY_OPENAI_API_KEY_REF,
    },
  };
}
