import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPERCLIP_HANDOFF_TTL_SECONDS,
  PaperclipHandoffConfigError,
  PAPERCLIP_HANDOFF_CONTRACT_VERSION,
  buildPaperclipHandoffPayload,
  getMissingPaperclipHandoffEnv,
  isValidPaperclipRuntimeUrl,
  isPaperclipHandoffReadyStatus,
  resolvePaperclipHandoffConfig,
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
    expect(getMissingPaperclipHandoffEnv({} as NodeJS.ProcessEnv)).toEqual([
      "PAPERCLIP_RUNTIME_URL",
      "PAPERCLIP_HANDOFF_SECRET",
    ]);

    expect(
      getMissingPaperclipHandoffEnv({
        PAPERCLIP_RUNTIME_URL: "https://runtime.pixelport.app",
      } as NodeJS.ProcessEnv),
    ).toEqual(["PAPERCLIP_HANDOFF_SECRET"]);
  });

  it("validates runtime URL format and rejects malformed values", () => {
    expect(isValidPaperclipRuntimeUrl("https://paperclip.pixelport.app")).toBe(true);
    expect(isValidPaperclipRuntimeUrl("http://localhost:3000")).toBe(true);
    expect(isValidPaperclipRuntimeUrl("paperclip.pixelport.app")).toBe(false);

    expect(() =>
      resolvePaperclipHandoffConfig({
        PAPERCLIP_RUNTIME_URL: "paperclip.pixelport.app",
        PAPERCLIP_HANDOFF_SECRET: "secret-value",
      } as NodeJS.ProcessEnv),
    ).toThrow(PaperclipHandoffConfigError);
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
