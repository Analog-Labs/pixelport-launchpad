import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const repairBootstrapHooksOnDroplet = vi.fn();
const approveGatewayPairingViaSsh = vi.fn();
const loadBootstrapSnapshot = vi.fn();
const reconcileBootstrapState = vi.fn();
const transitionBootstrapState = vi.fn();
const buildOnboardingBootstrapMessage = vi.fn(() => "bootstrap-message");
const dispatchBootstrapWithPairingRecovery = vi.fn();
const fromMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const classifyGatewayFailure = vi.fn(({ message }: { message: string }) => ({
  tag: "gateway_request_failed",
  retryable: true,
  message,
  missingScope: null,
  requestId: null,
}));
const formatGatewayDiagnostic = vi.fn(
  (diagnostic: { tag: string; message: string }) =>
    `[${diagnostic.tag}] ${diagnostic.message}`,
);

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/bootstrap-hooks-repair", () => ({
  repairBootstrapHooksOnDroplet,
}));

vi.mock("../../api/lib/openclaw-pairing-ssh", () => ({
  approveGatewayPairingViaSsh,
}));

vi.mock("../../api/lib/bootstrap-state", () => ({
  loadBootstrapSnapshot,
  reconcileBootstrapState,
  transitionBootstrapState,
}));

vi.mock("../../api/lib/onboarding-bootstrap", () => ({
  buildOnboardingBootstrapMessage,
}));

vi.mock("../../api/lib/openclaw-bootstrap-guard", () => ({
  dispatchBootstrapWithPairingRecovery,
  classifyGatewayFailure,
  formatGatewayDiagnostic,
}));

vi.mock("../../api/lib/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe("POST /api/tenants/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleMock.mockResolvedValue({ data: { onboarding_data: {} }, error: null });
    selectMock.mockReturnValue({ single: singleMock });
    eqMock.mockReturnValue({ select: selectMock });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
    loadBootstrapSnapshot.mockResolvedValue({
      onboardingData: {},
      state: {
        status: "failed",
        source: "provisioning",
        requested_at: "2026-03-10T10:00:00.000Z",
        accepted_at: "2026-03-10T10:01:00.000Z",
        completed_at: null,
        last_error: "Bootstrap timed out before durable dashboard truth was written.",
      },
      updatedAt: "2026-03-10T10:20:00.000Z",
    });
    transitionBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        state: {
          status: "accepted",
          source: "manual_bootstrap",
          requested_at: "2026-03-10T10:30:00.000Z",
          accepted_at: "2026-03-10T10:30:02.000Z",
          completed_at: null,
          last_error: null,
        },
        updatedAt: "2026-03-10T10:30:02.000Z",
      },
      changed: true,
    });
    dispatchBootstrapWithPairingRecovery.mockResolvedValue({
      ok: true,
      status: 202,
      body: "accepted",
      diagnostics: null,
      autoPairAttempted: false,
      autoPairApproved: false,
      autoPairReason: null,
    });
  });

  it("allows replay when durable output is partial but bootstrap has failed", async () => {
    const { default: handler } = await import("../../api/tenants/bootstrap");

    authenticateRequest.mockResolvedValue({
      userId: "user-1",
      tenant: {
        id: "tenant-1",
        status: "active",
        name: "Analog",
        droplet_ip: "127.0.0.1",
        gateway_token: "gw-1",
        onboarding_data: {},
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        state: {
          status: "failed",
        },
        updatedAt: "2026-03-10T10:20:00.000Z",
      },
      progress: {
        taskCount: 0,
        competitorCount: 0,
        agentUpdatedVaultCount: 1,
        hasAgentOutput: true,
      },
      effectiveState: {
        status: "failed",
        last_error: "Bootstrap timed out before durable dashboard truth was written.",
      },
      changed: false,
    });

    const req = {
      method: "POST",
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(202);
    expect(dispatchBootstrapWithPairingRecovery).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      accepted: true,
      gateway_status: 202,
      existing_output_present: true,
      hooks_repaired: false,
      bootstrap_status: "accepted",
      startup_source: "manual_bootstrap",
      forced: false,
      auto_pair_attempted: false,
      auto_pair_approved: false,
      auto_pair_reason: null,
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onboarding_data: expect.objectContaining({
          startup_provenance: expect.objectContaining({
            manual_bootstrap: expect.objectContaining({
              startup_source: "manual_bootstrap",
              invoked_by_user_id: "user-1",
              invoked_at: expect.any(String),
              force: false,
            }),
          }),
        }),
      }),
    );
  });

  it("blocks replay while bootstrap is still in progress", async () => {
    const { default: handler } = await import("../../api/tenants/bootstrap");

    authenticateRequest.mockResolvedValue({
      userId: "user-2",
      tenant: {
        id: "tenant-1",
        status: "active",
        name: "Analog",
        droplet_ip: "127.0.0.1",
        gateway_token: "gw-1",
        onboarding_data: {},
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        state: {
          status: "accepted",
        },
        updatedAt: "2026-03-10T10:20:00.000Z",
      },
      progress: {
        taskCount: 0,
        competitorCount: 0,
        agentUpdatedVaultCount: 1,
        hasAgentOutput: true,
      },
      effectiveState: {
        status: "accepted",
        last_error: null,
      },
      changed: false,
    });

    const req = {
      method: "POST",
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(dispatchBootstrapWithPairingRecovery).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      error: "Bootstrap is already in progress.",
      reason: "bootstrap_in_progress",
      bootstrap_status: "accepted",
      task_count: 0,
      competitor_count: 0,
      agent_updated_vault_count: 1,
    });
  });

  it("returns structured diagnostics when replay dispatch fails", async () => {
    const { default: handler } = await import("../../api/tenants/bootstrap");

    authenticateRequest.mockResolvedValue({
      userId: "user-3",
      tenant: {
        id: "tenant-1",
        status: "active",
        name: "Analog",
        droplet_ip: "127.0.0.1",
        gateway_token: "gw-1",
        onboarding_data: {},
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        state: {
          status: "failed",
        },
        updatedAt: "2026-03-10T10:20:00.000Z",
      },
      progress: {
        taskCount: 0,
        competitorCount: 0,
        agentUpdatedVaultCount: 0,
        hasAgentOutput: false,
      },
      effectiveState: {
        status: "failed",
        last_error: "missing scope: operator.write",
      },
      changed: false,
    });

    dispatchBootstrapWithPairingRecovery.mockResolvedValueOnce({
      ok: false,
      status: 500,
      body: "missing scope: operator.write",
      diagnostics: {
        tag: "missing_operator_scope",
        retryable: false,
        message: "missing scope: operator.write",
        missingScope: "operator.write",
        requestId: null,
      },
      autoPairAttempted: false,
      autoPairApproved: false,
      autoPairReason: null,
    });
    transitionBootstrapState.mockResolvedValueOnce({
      snapshot: {
        onboardingData: {},
        state: {
          status: "dispatching",
          source: "dashboard_replay",
          requested_at: "2026-03-10T10:30:00.000Z",
          accepted_at: null,
          completed_at: null,
          last_error: null,
        },
        updatedAt: "2026-03-10T10:30:00.000Z",
      },
      changed: true,
    });
    transitionBootstrapState.mockResolvedValueOnce({
      snapshot: {
        onboardingData: {},
        state: {
          status: "failed",
          source: "dashboard_replay",
          requested_at: "2026-03-10T10:30:00.000Z",
          accepted_at: null,
          completed_at: null,
          last_error: "[missing_operator_scope] missing scope: operator.write",
        },
        updatedAt: "2026-03-10T10:30:02.000Z",
      },
      changed: true,
    });

    const req = {
      method: "POST",
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      error: "Gateway rejected onboarding bootstrap",
      gateway_status: 500,
      details: "missing scope: operator.write",
      bootstrap_status: "failed",
      diagnostics: {
        tag: "missing_operator_scope",
        retryable: false,
        message: "missing scope: operator.write",
        missingScope: "operator.write",
        requestId: null,
      },
      auto_pair_attempted: false,
      auto_pair_approved: false,
      auto_pair_reason: null,
    });
  });

  it("blocks manual bootstrap when tenant is not active", async () => {
    const { default: handler } = await import("../../api/tenants/bootstrap");

    authenticateRequest.mockResolvedValue({
      userId: "user-4",
      tenant: {
        id: "tenant-1",
        status: "provisioning",
        name: "Analog",
        droplet_ip: "127.0.0.1",
        gateway_token: "gw-1",
        onboarding_data: {},
      },
    });

    const req = {
      method: "POST",
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: "Tenant must be active before bootstrap can be replayed",
      status: "provisioning",
    });
    expect(dispatchBootstrapWithPairingRecovery).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("records forced manual bootstrap provenance", async () => {
    const { default: handler } = await import("../../api/tenants/bootstrap");

    authenticateRequest.mockResolvedValue({
      userId: "user-force",
      tenant: {
        id: "tenant-1",
        status: "active",
        name: "Analog",
        droplet_ip: "127.0.0.1",
        gateway_token: "gw-1",
        onboarding_data: {},
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        state: {
          status: "failed",
        },
        updatedAt: "2026-03-10T10:20:00.000Z",
      },
      progress: {
        taskCount: 0,
        competitorCount: 0,
        agentUpdatedVaultCount: 0,
        hasAgentOutput: false,
      },
      effectiveState: {
        status: "failed",
        last_error: "timeout",
      },
      changed: false,
    });

    const req = {
      method: "POST",
      body: { force: true },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual(
      expect.objectContaining({
        accepted: true,
        startup_source: "manual_bootstrap",
        forced: true,
      }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onboarding_data: expect.objectContaining({
          startup_provenance: expect.objectContaining({
            manual_bootstrap: expect.objectContaining({
              startup_source: "manual_bootstrap",
              invoked_by_user_id: "user-force",
              force: true,
            }),
          }),
        }),
      }),
    );
  });
});
