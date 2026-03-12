import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

describe("provision tenant memory config", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_PROJECT_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.LITELLM_URL = "https://litellm.test";
    process.env.LITELLM_MASTER_KEY = "litellm-master";
    process.env.DO_API_TOKEN = "do-token";
  });

  it("emits the validated memorySearch config when native memory is enabled", async () => {
    const { buildOpenClawConfig } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const config = buildOpenClawConfig({
      tenantSlug: "pixelport-qa",
      gatewayToken: "gw-token",
      litellmUrl: "https://litellm.test",
      agentName: "Luna",
      memoryNativeEnabled: true,
      geminiApiKey: "",
      disableAcpDispatch: true,
    });

    expect(config).toMatchObject({
      agents: {
        defaults: {
          memorySearch: {
            enabled: true,
            provider: "openai",
            remote: {
              apiKey: "${MEMORY_OPENAI_API_KEY}",
            },
          },
        },
      },
    });
  });

  it("disables memorySearch when native memory is turned off for the tenant", async () => {
    const { buildOpenClawConfig } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const config = buildOpenClawConfig({
      tenantSlug: "pixelport-qa",
      gatewayToken: "gw-token",
      litellmUrl: "https://litellm.test",
      agentName: "Luna",
      memoryNativeEnabled: false,
      geminiApiKey: "",
      disableAcpDispatch: true,
    });

    expect(config).toMatchObject({
      agents: {
        defaults: {
          memorySearch: {
            enabled: false,
          },
        },
      },
    });
  });
});
