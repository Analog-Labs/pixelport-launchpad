import { describe, expect, it } from "vitest";
import {
  OPENCLAW_MEMORY_OPENAI_API_KEY_REF,
  applyTenantMemorySettingsDefaults,
  buildOpenClawMemorySearchConfig,
  resolveTenantMemoryProvisioningPlan,
  resolveTenantMemorySettings,
} from "../../api/lib/tenant-memory-settings";

describe("tenant memory settings", () => {
  it("resolves defaults for tenants that do not yet have memory settings", () => {
    expect(resolveTenantMemorySettings({ trial_budget_usd: 20 })).toEqual({
      nativeEnabled: true,
      mem0Enabled: false,
      rawSettings: {
        trial_budget_usd: 20,
      },
    });
  });

  it("preserves explicit tenant overrides", () => {
    expect(
      resolveTenantMemorySettings({
        memory_native_enabled: false,
        memory_mem0_enabled: true,
      }),
    ).toEqual({
      nativeEnabled: false,
      mem0Enabled: true,
      rawSettings: {
        memory_native_enabled: false,
        memory_mem0_enabled: true,
      },
    });
  });

  it("applies defaults when persisting new tenant settings", () => {
    expect(
      applyTenantMemorySettingsDefaults({
        trial_budget_usd: 20,
        timezone: "UTC",
      }),
    ).toEqual({
      trial_budget_usd: 20,
      timezone: "UTC",
      memory_native_enabled: true,
      memory_mem0_enabled: false,
    });
  });

  it("emits the validated OpenClaw memorySearch config for native memory", () => {
    expect(buildOpenClawMemorySearchConfig(true)).toEqual({
      enabled: true,
      provider: "openai",
      remote: {
        apiKey: OPENCLAW_MEMORY_OPENAI_API_KEY_REF,
      },
    });

    expect(buildOpenClawMemorySearchConfig(false)).toEqual({
      enabled: false,
    });
  });

  it("keeps native memory enabled during provisioning when the key exists", () => {
    expect(
      resolveTenantMemoryProvisioningPlan({
        settings: {
          memory_native_enabled: true,
          memory_mem0_enabled: false,
        },
        memoryOpenAiApiKey: "  sk-memory  ",
      }),
    ).toEqual({
      requestedNativeEnabled: true,
      effectiveNativeEnabled: true,
      mem0Enabled: false,
      nativeDowngradedMissingApiKey: false,
      memoryOpenAiApiKey: "sk-memory",
    });
  });

  it("downgrades native memory during provisioning when key is missing", () => {
    expect(
      resolveTenantMemoryProvisioningPlan({
        settings: {
          memory_native_enabled: true,
          memory_mem0_enabled: false,
        },
        memoryOpenAiApiKey: "",
      }),
    ).toEqual({
      requestedNativeEnabled: true,
      effectiveNativeEnabled: false,
      mem0Enabled: false,
      nativeDowngradedMissingApiKey: true,
      memoryOpenAiApiKey: "",
    });
  });

  it("does not mark downgrade when tenant already disabled native memory", () => {
    expect(
      resolveTenantMemoryProvisioningPlan({
        settings: {
          memory_native_enabled: false,
          memory_mem0_enabled: true,
        },
        memoryOpenAiApiKey: "",
      }),
    ).toEqual({
      requestedNativeEnabled: false,
      effectiveNativeEnabled: false,
      mem0Enabled: true,
      nativeDowngradedMissingApiKey: false,
      memoryOpenAiApiKey: "",
    });
  });
});
