import { describe, expect, it } from "vitest";
import {
  OPENCLAW_MEMORY_OPENAI_API_KEY_REF,
  applyTenantMemorySettingsDefaults,
  buildOpenClawMemorySearchConfig,
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
});
