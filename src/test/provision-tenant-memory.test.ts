import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_CONTRACT_VERSION } from "../../api/lib/workspace-contract";

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
    process.env.DO_API_TOKEN = "do-token";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.PAPERCLIP_HANDOFF_SECRET = "handoff-secret";
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
      agentName: "Luna",
      memoryNativeEnabled: true,
      geminiApiKey: "",
      disableAcpDispatch: true,
    });

    expect(config).toMatchObject({
      agents: {
        defaults: {
          skipBootstrap: true,
          heartbeat: {
            every: "0m",
          },
          memorySearch: {
            enabled: true,
            provider: "openai",
            extraPaths: ["knowledge"],
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
      agentName: "Luna",
      memoryNativeEnabled: false,
      geminiApiKey: "",
      disableAcpDispatch: true,
    });

    expect(config).toMatchObject({
      agents: {
        defaults: {
          skipBootstrap: true,
          heartbeat: {
            every: "0m",
          },
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

  it("enables temporary control-ui device-auth breakglass by default", async () => {
    const { buildOpenClawConfig } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const config = buildOpenClawConfig({
      tenantSlug: "pixelport-qa",
      gatewayToken: "gw-token",
      agentName: "Luna",
      memoryNativeEnabled: true,
      geminiApiKey: "",
      disableAcpDispatch: true,
    });

    expect(config).toMatchObject({
      gateway: {
        controlUi: {
          dangerouslyDisableDeviceAuth: true,
        },
      },
    });
  });

  it("supports overriding control-ui device-auth breakglass off", async () => {
    const { buildOpenClawConfig } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const config = buildOpenClawConfig({
      tenantSlug: "pixelport-qa",
      gatewayToken: "gw-token",
      agentName: "Luna",
      memoryNativeEnabled: true,
      geminiApiKey: "",
      disableAcpDispatch: true,
      disableControlUiDeviceAuth: false,
    });

    expect(config).toMatchObject({
      gateway: {
        controlUi: {
          dangerouslyDisableDeviceAuth: false,
        },
      },
    });
  });

  it("resolves runtime image to base image when override is blank", async () => {
    const { resolveOpenClawRuntimeImage } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    expect(
      resolveOpenClawRuntimeImage(
        "ghcr.io/openclaw/openclaw:2026.3.13-1",
        "",
      ),
    ).toBe("ghcr.io/openclaw/openclaw:2026.3.13-1");

    expect(
      resolveOpenClawRuntimeImage(
        "ghcr.io/openclaw/openclaw:2026.3.13-1",
        "   ",
      ),
    ).toBe("ghcr.io/openclaw/openclaw:2026.3.13-1");
  });

  it("uses direct OpenAI/Gemini model references in generated agent config", async () => {
    const { buildOpenClawConfig } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const config = buildOpenClawConfig({
      tenantSlug: "pixelport-qa",
      gatewayToken: "gw-token",
      agentName: "Luna",
      memoryNativeEnabled: true,
      geminiApiKey: "gemini-key",
      disableAcpDispatch: true,
    });

    expect(config).toMatchObject({
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-5.4",
            fallbacks: ["google/gemini-2.5-flash", "openai/gpt-4o-mini"],
          },
        },
        list: [
          {
            model: "openai/gpt-5.4",
          },
        ],
      },
    });
  });

  it("resolves runtime image to override when provided", async () => {
    const { resolveOpenClawRuntimeImage } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    expect(
      resolveOpenClawRuntimeImage(
        "ghcr.io/openclaw/openclaw:2026.3.13-1",
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

  it("normalizes DigitalOcean JSON error payloads into concise strings", async () => {
    const { summarizeDigitalOceanErrorBody } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    expect(
      summarizeDigitalOceanErrorBody(
        JSON.stringify({
          id: "unprocessable_entity",
          message: "You specified an invalid region.",
        }),
      ),
    ).toBe("unprocessable_entity: You specified an invalid region.");

    expect(summarizeDigitalOceanErrorBody("plain error body")).toBe(
      "plain error body",
    );
  });

  it("detects duplicate-name 422 responses from DigitalOcean", async () => {
    const { isDropletNameConflictError } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    expect(
      isDropletNameConflictError(
        JSON.stringify({
          id: "unprocessable_entity",
          message: "name is already in use on this account",
        }),
      ),
    ).toBe(true);

    expect(
      isDropletNameConflictError(
        JSON.stringify({
          id: "unprocessable_entity",
          message: "image is not available in this region",
        }),
      ),
    ).toBe(false);
  });

  it("builds region fallback order constrained by image availability", async () => {
    const { buildDropletRegionFallbackOrder } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const order = buildDropletRegionFallbackOrder("nyc1", [
      "nyc3",
      "sfo3",
      "nyc1",
    ]);

    expect(order).toEqual(["nyc1", "nyc3", "sfo3"]);
  });

  it("keeps requested region first even when image region metadata is empty", async () => {
    const { buildDropletRegionFallbackOrder } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const order = buildDropletRegionFallbackOrder("nyc1", []);

    expect(order[0]).toBe("nyc1");
    expect(order).toContain("nyc3");
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

  it("prefers tenant base domain for runtime ingress plan when configured", async () => {
    const { resolveRuntimeIngressPlan } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const plan = resolveRuntimeIngressPlan({
      tenantSlug: "pixelport-qa",
      env: {
        PAPERCLIP_RUNTIME_BASE_DOMAIN: "runtime.pixelport.ai",
      } as NodeJS.ProcessEnv,
    });

    expect(plan).toEqual({
      hostTemplate: "pixelport-qa.runtime.pixelport.ai",
      source: "base_domain",
    });
  });

  it("falls back to sslip runtime ingress plan when base domain is absent", async () => {
    const { resolveRuntimeIngressPlan } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const plan = resolveRuntimeIngressPlan({
      tenantSlug: "pixelport-qa",
      env: {} as NodeJS.ProcessEnv,
    });

    expect(plan).toEqual({
      hostTemplate: "pixelport-qa.__PUBLIC_IPV4_DASH__.sslip.io",
      source: "sslip",
    });
  });

  it("resolves final runtime ingress URL from droplet ip and sslip plan", async () => {
    const {
      resolveRuntimeIngressFromDroplet,
      resolveRuntimeIngressPlan,
    } = await import("../../api/inngest/functions/provision-tenant");

    const plan = resolveRuntimeIngressPlan({
      tenantSlug: "pixelport-qa",
      env: {} as NodeJS.ProcessEnv,
    });

    const resolved = resolveRuntimeIngressFromDroplet({
      dropletIp: "157.245.253.88",
      runtimeIngressPlan: plan,
    });

    expect(resolved).toEqual({
      host: "pixelport-qa.157-245-253-88.sslip.io",
      url: "https://pixelport-qa.157-245-253-88.sslip.io",
      source: "sslip",
    });
  });

  it("generates cloud-init without chromium build steps", async () => {
    const { buildCloudInit } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const script = buildCloudInit({
      tenantId: "tenant-123",
      tenantSlug: "pixelport-qa",
      tenantName: "PixelPort QA",
      gatewayToken: "gw-token",
      runtimeHostTemplate: "pixelport-qa.__PUBLIC_IPV4_DASH__.sslip.io",
      openclawBaseImage: "ghcr.io/openclaw/openclaw:2026.3.13-1",
      openclawRuntimeImage: "ghcr.io/openclaw/openclaw:2026.3.13-1",
      paperclipImage: "pixelport-paperclip:2026.3.11-handoff-p1",
      openaiApiKey: "openai-key",
      paperclipHandoffSecret: "handoff-secret",
      supabaseUrl: "https://supabase.example.co",
      supabaseServiceRoleKey: "supabase-service-role",
      memoryOpenAiApiKey: "memory-openai-key",
      memoryNativeEnabled: true,
      geminiApiKey: "",
      agentmailApiKey: "",
      agentApiKey: "ppk-test",
      paperclipApiKey: "pak-test",
      onboardingData: {
        agent_name: "Luna",
      },
    });

    expect(script).toContain("if docker image inspect ghcr.io/openclaw/openclaw:2026.3.13-1 >/dev/null 2>&1; then");
    expect(script).toContain("docker pull ghcr.io/openclaw/openclaw:2026.3.13-1");
    expect(script).toContain("RUNTIME_HOST_TEMPLATE='pixelport-qa.__PUBLIC_IPV4_DASH__.sslip.io'");
    expect(script).not.toContain("docker build -t");
    expect(script).not.toContain("/opt/openclaw/image");
    expect(script).not.toContain("--no-install-recommends chromium");
    expect(script).toContain("OPENAI_API_KEY=openai-key");
    expect(script).toContain("PAPERCLIP_HANDOFF_SECRET=handoff-secret");
    expect(script).not.toContain("OPENAI_BASE_URL=");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/AGENTS.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/BOOT.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/HEARTBEAT.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/IDENTITY.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/MEMORY.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/SOUL.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/TOOLS.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/USER.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/knowledge/company-overview.md");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/system/onboarding.json");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/system/render-manifest.json");
    expect(script).toContain("cat > /opt/openclaw/workspace-main/skills/paperclip/SKILL.md");
    expect(script).not.toContain("cat > /opt/openclaw/workspace-main/BOOTSTRAP.md");
    expect(script).toContain('"skipBootstrap": true');
    expect(script).toContain('"heartbeat": {');
    expect(script).toContain('"every": "0m"');
    expect(script).toContain('"extraPaths": [');
    expect(script).toContain('"knowledge"');
    expect(script).toContain("chmod 600 /opt/openclaw/openclaw.json /opt/openclaw/.env");
    expect(script).toContain('"dangerouslyDisableDeviceAuth": true');
    expect(script).toContain("normalize_runtime_state_perms()");
    expect(script).toContain("docker network create paperclip-net");
    expect(script).toContain("docker run -d --name paperclip-db");
    expect(script).toContain("docker run -d --name paperclip-bootstrap");
    expect(script).toContain("PAPERCLIP_DEPLOYMENT_MODE=local_trusted");
    expect(script).toContain("curl -sf -X PATCH \"https://supabase.example.co/rest/v1/tenants?id=eq.tenant-123\"");
    expect(script).toContain("docker run -d --name paperclip");
    expect(script).toContain('"adapterType":"openclaw_gateway"');
    expect(script).toContain('"url":"ws://host.docker.internal:18789"');
    expect(script).toContain('"x-openclaw-token":"gw-token"');
    expect(script).toContain('"role":"operator"');
    expect(script).toContain(
      '"scopes":["operator.read","operator.write","operator.admin","operator.approvals","operator.pairing"]',
    );
    expect(script).toContain('"disableDeviceAuth":false');
    expect(script).toContain('"deviceId":"');
    expect(script).toContain('"devicePrivateKeyPem":"-----BEGIN PRIVATE KEY-----\\n');
    expect(script).toContain("--add-host host.docker.internal:host-gateway");
    expect(script).toContain("PAPERCLIP_DEPLOYMENT_MODE=authenticated");
    expect(script).toContain("sed -i.bak \"s/^PAPERCLIP_API_KEY=.*/PAPERCLIP_API_KEY=$API_TOKEN/\" /opt/openclaw/.env");
    expect(script).toContain("persist_openclaw_claimed_api_keys()");
    expect(script).toContain("/home/node/.openclaw/workspace-main-claimed-api-key.json");
    expect(script).toContain("/home/node/.openclaw/workspace[]-claimed-api-key.json");
    expect(script).toContain("/home/node/.openclaw/workspace/paperclip-claimed-api-key.json");
    expect(script).toContain("/home/node/.openclaw/workspace-main/paperclip-claimed-api-key.json");
    expect(script).toContain(
      "mkdir -p /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices",
    );
    expect(script).toContain(
      "chown 1000:1000 /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices",
    );
    expect(script).toContain(
      "chmod 700 /home/node/.openclaw /home/node/.openclaw/identity /home/node/.openclaw/devices",
    );
    expect(script).toContain("apt-get install -y caddy");
    expect(script).toContain("reverse_proxy 127.0.0.1:18789");
  });

  it("keeps strict OpenClaw config validation and fail-fast fallback in cloud-init", async () => {
    const { buildCloudInit } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const script = buildCloudInit({
      tenantId: "tenant-validate-123",
      tenantSlug: "validate-tenant",
      tenantName: "Validate Tenant",
      gatewayToken: "gw-token",
      runtimeHostTemplate: "validate-tenant.__PUBLIC_IPV4_DASH__.sslip.io",
      openclawBaseImage: "ghcr.io/openclaw/openclaw:2026.3.13-1",
      openclawRuntimeImage: "ghcr.io/openclaw/openclaw:2026.3.13-1",
      paperclipImage: "pixelport-paperclip:2026.3.11-handoff-p1",
      openaiApiKey: "openai-key",
      paperclipHandoffSecret: "handoff-secret",
      supabaseUrl: "https://supabase.example.co",
      supabaseServiceRoleKey: "supabase-service-role",
      memoryOpenAiApiKey: "memory-openai-key",
      memoryNativeEnabled: true,
      geminiApiKey: "",
      agentmailApiKey: "",
      agentApiKey: "ppk-test",
      paperclipApiKey: "pak-test",
      onboardingData: {
        agent_name: "Luna",
      },
    });

    expect(script).toContain("validate_openclaw_config()");
    expect(script).toContain("openclaw.mjs config validate --json");
    expect(script).toContain("if validate_openclaw_config /opt/openclaw/config-validate.with-acp.json; then");
    expect(script).toContain("if validate_openclaw_config /opt/openclaw/config-validate.no-acp.json; then");
    expect(script).toContain("OpenClaw config validation failed even after removing ACP dispatch");
    expect(script).toContain("OpenClaw config validation failed before startup");
    expect(script).toContain("exit 1");
  });

  it("includes onboarding starter task in the kickoff issue description", async () => {
    const { buildOnboardingKickoffIssueDescription } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const description = buildOnboardingKickoffIssueDescription({
      tenantName: "PixelPort QA",
      onboardingData: {
        company_url: "https://pixelport.test",
        mission_goals: "Grow pipeline quality",
        starter_task: "Draft a 7-day launch plan",
        goals: ["Improve conversion", "Increase velocity"],
      },
    });

    expect(description).toContain("Starter task: Draft a 7-day launch plan");
    expect(description).toContain("Onboarding goals:");
    expect(description).toContain("- Improve conversion");
  });

  it("builds bootstrap seed evidence with workspace/memory contract metadata", async () => {
    const { buildBootstrapSeedEvidence } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const evidence = buildBootstrapSeedEvidence({
      onboardingData: {
        starter_task: "Ship a retention campaign",
        goals: ["Retention"],
        agent_suggestions: [
          { id: "a1", role: "Chief" },
          { id: "a2", role: "Growth" },
        ],
      },
      issueId: "issue-1",
      approvalId: "approval-1",
      wakeRunId: "run-1",
      chiefAgentId: "agent-1",
      expectedDeviceId: "device-1",
      at: "2026-03-24T00:00:00.000Z",
    });

    expect(evidence).toMatchObject({
      kickoff_issue_id: "issue-1",
      kickoff_approval_id: "approval-1",
      wake_run_id: "run-1",
      chief_agent_id: "agent-1",
      expected_device_id: "device-1",
      starter_task: "Ship a retention campaign",
      onboarding_goals: ["Retention"],
      agent_suggestions_count: 2,
      workspace_contract: {
        version: WORKSPACE_CONTRACT_VERSION,
        memory_contract: "memory-para-v1",
      },
    });
  });

  it("validates chief gateway adapter state for persisted config completeness", async () => {
    const { validateChiefGatewayState } = await import(
      "../../api/inngest/functions/provision-tenant"
    );

    const issues = validateChiefGatewayState(
      {
        adapterType: "openclaw_gateway",
        role: "operator",
        scopes: ["operator.read"],
        missingScopes: ["operator.write", "operator.admin"],
        gatewayWsUrl: "ws://host.docker.internal:18789",
        gatewayToken: null,
        disableDeviceAuth: false,
        devicePrivateKeyPem: null,
        expectedDeviceId: null,
      },
      {
        expectedGatewayWsUrl: "ws://host.docker.internal:18789",
        expectedGatewayToken: "gw-token",
        expectedDisableDeviceAuth: false,
      },
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        "missing_scopes=operator.write,operator.admin",
        "gateway_token=missing_or_mismatched",
        "device_private_key=missing",
        "device_id=missing",
      ]),
    );
  });
});
