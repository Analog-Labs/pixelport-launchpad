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
    process.env.PROVISIONING_DROPLET_IMAGE =
      "pixelport-paperclip-golden-2026-03-16";
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

  it("marks baseline as missing when no golden image selector is configured", async () => {
    const { resolveDropletBaseline, assertGoldenImageConfigured } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const baseline = resolveDropletBaseline({});

    expect(baseline.image).toBe("");
    expect(baseline.imageSource).toBe("missing");
    expect(() => assertGoldenImageConfigured(baseline)).toThrowError(
      /Set PROVISIONING_DROPLET_IMAGE/,
    );
  });

  it("defaults size and region when image selector is configured", async () => {
    const { resolveDropletBaseline, assertGoldenImageConfigured } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const baseline = resolveDropletBaseline({
      PROVISIONING_DROPLET_IMAGE: "pixelport-paperclip-golden-v2",
    } as NodeJS.ProcessEnv);

    expect(baseline.image).toBe("pixelport-paperclip-golden-v2");
    expect(baseline.size).toBe("s-4vcpu-8gb");
    expect(baseline.region).toBe("nyc1");
    expect(baseline.imageSource).toBe("managed");
    expect(() => assertGoldenImageConfigured(baseline)).not.toThrow();
  });

  it("resolves droplet baseline from canonical provisioning env vars", async () => {
    const { resolveDropletBaseline } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const baseline = resolveDropletBaseline({
      PROVISIONING_DROPLET_IMAGE: "pixelport-paperclip-golden-v2",
      PROVISIONING_DROPLET_SIZE: "s-8vcpu-16gb",
      PROVISIONING_DROPLET_REGION: "nyc3",
    } as NodeJS.ProcessEnv);

    expect(baseline.image).toBe("pixelport-paperclip-golden-v2");
    expect(baseline.size).toBe("s-8vcpu-16gb");
    expect(baseline.region).toBe("nyc3");
    expect(baseline.imageSource).toBe("managed");
  });

  it("falls back to legacy image vars when canonical vars are unset", async () => {
    const { resolveDropletBaseline } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const baseline = resolveDropletBaseline({
      PIXELPORT_DROPLET_IMAGE: "pixelport-paperclip-golden-legacy",
      PIXELPORT_DROPLET_SIZE: "s-4vcpu-8gb",
      PIXELPORT_DROPLET_REGION: "sfo3",
    } as NodeJS.ProcessEnv);

    expect(baseline.image).toBe("pixelport-paperclip-golden-legacy");
    expect(baseline.size).toBe("s-4vcpu-8gb");
    expect(baseline.region).toBe("sfo3");
    expect(baseline.imageSource).toBe("managed");
  });

  it("supports DO_GOLDEN_IMAGE_ID when PIXELPORT_DROPLET_IMAGE is absent", async () => {
    const { resolveDropletBaseline } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const baseline = resolveDropletBaseline({
      DO_GOLDEN_IMAGE_ID: "217894561",
    } as NodeJS.ProcessEnv);

    expect(baseline.image).toBe("217894561");
    expect(baseline.imageSource).toBe("managed");
  });

  it("classifies ubuntu selector as compatibility and supports optional managed-only enforcement", async () => {
    const { resolveDropletBaseline, assertGoldenImageConfigured } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const baseline = resolveDropletBaseline({
      PROVISIONING_DROPLET_IMAGE: "ubuntu-24-04-x64",
    } as NodeJS.ProcessEnv);

    expect(baseline.imageSource).toBe("compatibility");
    expect(() => assertGoldenImageConfigured(baseline)).not.toThrow();
    expect(() =>
      assertGoldenImageConfigured(baseline, {
        PROVISIONING_REQUIRE_MANAGED_GOLDEN_IMAGE: "true",
      } as NodeJS.ProcessEnv),
    ).toThrowError(/Managed golden image selector required/);
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
