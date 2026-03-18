import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS,
  PAPERCLIP_HANDOFF_CONTRACT_VERSION,
  PAPERCLIP_RUNTIME_PORT,
  buildGatewayControlUiLaunchUrl,
  buildPaperclipHandoffPayload,
  getMissingPaperclipHandoffEnv,
  isPaperclipHandoffReadyStatus,
  resolvePaperclipHandoffConfig,
  resolvePaperclipRuntimeUrlFromDropletIp,
  resolvePaperclipHandoffTtlSeconds,
  signPaperclipHandoffPayload,
} from "../../api/lib/paperclip-handoff-contract";

describe("paperclip handoff contract", () => {
  it("treats active and ready as handoff-ready statuses", () => {
    expect(isPaperclipHandoffReadyStatus("active")).toBe(true);
    expect(isPaperclipHandoffReadyStatus("READY")).toBe(true);
    expect(isPaperclipHandoffReadyStatus("provisioning")).toBe(false);
    expect(isPaperclipHandoffReadyStatus(undefined)).toBe(false);
  });

  it("resolves ttl with sane defaults and caps", () => {
    expect(resolvePaperclipHandoffTtlSeconds(undefined)).toBe(DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS);
    expect(resolvePaperclipHandoffTtlSeconds("")).toBe(DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS);
    expect(resolvePaperclipHandoffTtlSeconds("-5")).toBe(DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS);
    expect(resolvePaperclipHandoffTtlSeconds("120")).toBe(120);
    expect(resolvePaperclipHandoffTtlSeconds("9999")).toBe(3600);
  });

  it("reports missing required env vars", () => {
    expect(getMissingPaperclipHandoffEnv({} as NodeJS.ProcessEnv)).toEqual(["PAPERCLIP_HANDOFF_SECRET"]);

    expect(
      getMissingPaperclipHandoffEnv({
        PAPERCLIP_HANDOFF_SECRET: "secret-value",
      } as NodeJS.ProcessEnv),
    ).toEqual([]);
  });

  it("derives runtime URL from valid droplet IPs only", () => {
    expect(resolvePaperclipRuntimeUrlFromDropletIp(undefined)).toBeNull();
    expect(resolvePaperclipRuntimeUrlFromDropletIp("")).toBeNull();
    expect(resolvePaperclipRuntimeUrlFromDropletIp("not-an-ip")).toBeNull();
    expect(resolvePaperclipRuntimeUrlFromDropletIp("999.1.1.1")).toBeNull();
    expect(resolvePaperclipRuntimeUrlFromDropletIp("1.2.3.4")).toBe(`http://1.2.3.4:${PAPERCLIP_RUNTIME_PORT}`);
    expect(resolvePaperclipRuntimeUrlFromDropletIp("2001:db8::1")).toBe(
      `http://[2001:db8::1]:${PAPERCLIP_RUNTIME_PORT}`,
    );
  });

  it("builds a control-ui launch URL with hash token when runtime + gateway token exist", () => {
    expect(buildGatewayControlUiLaunchUrl(null, "gw-token")).toBeNull();
    expect(buildGatewayControlUiLaunchUrl("http://1.2.3.4:18789", null)).toBeNull();
    expect(buildGatewayControlUiLaunchUrl("notaurl", "gw-token")).toBeNull();
    expect(buildGatewayControlUiLaunchUrl("ftp://1.2.3.4:18789", "gw-token")).toBeNull();
    expect(buildGatewayControlUiLaunchUrl("http://1.2.3.4:18789", "  ")).toBeNull();
    expect(buildGatewayControlUiLaunchUrl("http://1.2.3.4:18789", "gw-token")).toBe(
      "http://1.2.3.4:18789/#token=gw-token",
    );
  });

  it("resolves handoff config from secret + ttl env", () => {
    const config = resolvePaperclipHandoffConfig({
      PAPERCLIP_HANDOFF_SECRET: "secret-value",
      PAPERCLIP_HANDOFF_TTL_SECONDS: "120",
    } as NodeJS.ProcessEnv);

    expect(config.handoffSecret).toBe("secret-value");
    expect(config.ttlSeconds).toBe(120);
  });

  it("builds a canonical payload with contract version and expiry", () => {
    const payload = buildPaperclipHandoffPayload({
      userId: "user-1",
      tenantId: "tenant-1",
      tenantSlug: "tenant-slug",
      tenantStatus: "active",
      tenantPlan: "trial",
      source: "dashboard-launch",
      ttlSeconds: 300,
      nowEpochSeconds: 1_000_000,
    });

    expect(payload.v).toBe(PAPERCLIP_HANDOFF_CONTRACT_VERSION);
    expect(payload.iss).toBe("pixelport-launchpad");
    expect(payload.aud).toBe("paperclip-runtime");
    expect(payload.iat).toBe(1_000_000);
    expect(payload.exp).toBe(1_000_300);
    expect(payload.user_id).toBe("user-1");
    expect(payload.tenant_id).toBe("tenant-1");
    expect(payload.tenant_slug).toBe("tenant-slug");
    expect(payload.tenant_status).toBe("active");
    expect(payload.tenant_plan).toBe("trial");
    expect(payload.source).toBe("dashboard-launch");
    expect(payload.jti.length).toBeGreaterThan(10);
  });

  it("signs payloads with HMAC-SHA256 base64url token format", () => {
    const payload = buildPaperclipHandoffPayload({
      userId: "user-1",
      tenantId: "tenant-1",
      tenantSlug: "tenant-slug",
      tenantStatus: "active",
      tenantPlan: "trial",
      source: "launchpad",
      ttlSeconds: 300,
      nowEpochSeconds: 1_000_000,
    });

    const token = signPaperclipHandoffPayload(payload, "secret-value");
    const [encodedPayload, signature] = token.split(".");

    expect(encodedPayload).toBeTruthy();
    expect(signature).toBeTruthy();

    const expectedSignature = createHmac("sha256", "secret-value")
      .update(encodedPayload)
      .digest("base64url");

    expect(signature).toBe(expectedSignature);
  });
});
