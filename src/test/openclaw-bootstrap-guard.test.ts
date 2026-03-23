import { beforeEach, describe, expect, it, vi } from "vitest";

const triggerOnboardingBootstrap = vi.fn();

vi.mock("../../api/lib/onboarding-bootstrap", () => ({
  triggerOnboardingBootstrap,
}));

describe("openclaw bootstrap guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies missing scope errors as non-retryable scope failures", async () => {
    const { classifyGatewayFailure } = await import("../../api/lib/openclaw-bootstrap-guard");

    const diagnostics = classifyGatewayFailure({
      status: 500,
      message: "openclaw_gateway_request_failed: missing scope: operator.write",
    });

    expect(diagnostics).toEqual({
      tag: "missing_operator_scope",
      retryable: false,
      message: "openclaw_gateway_request_failed: missing scope: operator.write",
      missingScope: "operator.write",
      requestId: null,
    });
  });

  it("classifies readiness timeout strings with explicit timeout tag", async () => {
    const { classifyGatewayFailure } = await import("../../api/lib/openclaw-bootstrap-guard");

    const diagnostics = classifyGatewayFailure({
      status: 500,
      message: "OpenClaw gateway did not become healthy within 10 minutes",
    });

    expect(diagnostics.tag).toBe("readiness_timeout");
    expect(diagnostics.retryable).toBe(true);
  });

  it("treats missing operator.pairing scope as pairing-recovery eligible", async () => {
    const { classifyGatewayFailure, isPairingRecoveryEligible } = await import("../../api/lib/openclaw-bootstrap-guard");

    const diagnostics = classifyGatewayFailure({
      status: 500,
      message: "openclaw_gateway_pairing_required: missing scope: operator.pairing",
    });

    expect(diagnostics.tag).toBe("missing_operator_scope");
    expect(diagnostics.missingScope).toBe("operator.pairing");
    expect(isPairingRecoveryEligible(diagnostics)).toBe(true);
  });

  it("passes through successful bootstrap dispatch without auto-pair attempts", async () => {
    const { dispatchBootstrapWithPairingRecovery } = await import("../../api/lib/openclaw-bootstrap-guard");

    triggerOnboardingBootstrap.mockResolvedValueOnce({
      ok: true,
      status: 202,
      body: "accepted",
    });

    const result = await dispatchBootstrapWithPairingRecovery({
      gatewayHttpUrl: "http://127.0.0.1:18789",
      gatewayWsUrl: "ws://127.0.0.1:18789",
      gatewayToken: "gw-token",
      message: "bootstrap",
    });

    expect(result).toEqual({
      ok: true,
      status: 202,
      body: "accepted",
      diagnostics: null,
      autoPairAttempted: false,
      autoPairApproved: false,
      autoPairReason: null,
    });
  });

  it("returns diagnostics for non-pairing dispatch failures", async () => {
    const { dispatchBootstrapWithPairingRecovery } = await import("../../api/lib/openclaw-bootstrap-guard");

    triggerOnboardingBootstrap.mockResolvedValueOnce({
      ok: false,
      status: 500,
      body: "openclaw_gateway_request_failed: missing scope: operator.write",
    });

    const result = await dispatchBootstrapWithPairingRecovery({
      gatewayHttpUrl: "http://127.0.0.1:18789",
      gatewayWsUrl: "ws://127.0.0.1:18789",
      gatewayToken: "gw-token",
      message: "bootstrap",
    });

    expect(result.ok).toBe(false);
    expect(result.autoPairAttempted).toBe(false);
    expect(result.diagnostics).toMatchObject({
      tag: "missing_operator_scope",
      missingScope: "operator.write",
    });
  });
});
