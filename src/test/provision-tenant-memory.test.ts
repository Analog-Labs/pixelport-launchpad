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

  it("denies browser tool usage in the generated main agent config", async () => {
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
        list: [
          {
            tools: {
              profile: "full",
              deny: ["browser"],
            },
          },
        ],
      },
    });
  });

  it("resolves runtime image to base image when override is blank", async () => {
    const { resolveOpenClawRuntimeImage } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    expect(
      resolveOpenClawRuntimeImage(
        "ghcr.io/openclaw/openclaw:2026.3.11",
        "",
      ),
    ).toBe("ghcr.io/openclaw/openclaw:2026.3.11");

    expect(
      resolveOpenClawRuntimeImage(
        "ghcr.io/openclaw/openclaw:2026.3.11",
        "   ",
      ),
    ).toBe("ghcr.io/openclaw/openclaw:2026.3.11");
  });

  it("resolves runtime image to override when provided", async () => {
    const { resolveOpenClawRuntimeImage } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    expect(
      resolveOpenClawRuntimeImage(
        "ghcr.io/openclaw/openclaw:2026.3.11",
        "pixelport-openclaw:custom-runtime",
      ),
    ).toBe("pixelport-openclaw:custom-runtime");
  });

  it("generates cloud-init without chromium build steps", async () => {
    const { buildCloudInit } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const script = buildCloudInit({
      tenantSlug: "pixelport-qa",
      tenantName: "PixelPort QA",
      gatewayToken: "gw-token",
      openclawBaseImage: "ghcr.io/openclaw/openclaw:2026.3.11",
      openclawRuntimeImage: "ghcr.io/openclaw/openclaw:2026.3.11",
      litellmUrl: "https://litellm.test",
      litellmKey: "litellm-key",
      memoryOpenAiApiKey: "memory-openai-key",
      memoryNativeEnabled: true,
      geminiApiKey: "",
      agentmailApiKey: "",
      agentApiKey: "ppk-test",
      onboardingData: {
        agent_name: "Luna",
      },
    });

    expect(script).toContain("docker pull ghcr.io/openclaw/openclaw:2026.3.11");
    expect(script).not.toContain("docker build -t");
    expect(script).not.toContain("/opt/openclaw/image");
    expect(script).not.toContain("--no-install-recommends chromium");
    expect(script).toContain("chmod 600 /opt/openclaw/openclaw.json /opt/openclaw/.env");
    expect(script).toContain("normalize_runtime_state_perms()");
    expect(script).toContain(
      "mkdir -p /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices",
    );
    expect(script).toContain(
      "chown 1000:1000 /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices",
    );
    expect(script).toContain(
      "chmod 700 /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices",
    );
  });
});
