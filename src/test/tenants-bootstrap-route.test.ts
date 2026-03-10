import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const repairBootstrapHooksOnDroplet = vi.fn();
const loadBootstrapSnapshot = vi.fn();
const reconcileBootstrapState = vi.fn();
const transitionBootstrapState = vi.fn();
const buildOnboardingBootstrapMessage = vi.fn(() => "bootstrap-message");
const triggerOnboardingBootstrap = vi.fn();

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/bootstrap-hooks-repair", () => ({
  repairBootstrapHooksOnDroplet,
}));

vi.mock("../../api/lib/bootstrap-state", () => ({
  loadBootstrapSnapshot,
  reconcileBootstrapState,
  transitionBootstrapState,
}));

vi.mock("../../api/lib/onboarding-bootstrap", () => ({
  buildOnboardingBootstrapMessage,
  triggerOnboardingBootstrap,
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
          source: "dashboard_replay",
          requested_at: "2026-03-10T10:30:00.000Z",
          accepted_at: "2026-03-10T10:30:02.000Z",
          completed_at: null,
          last_error: null,
        },
        updatedAt: "2026-03-10T10:30:02.000Z",
      },
      changed: true,
    });
    triggerOnboardingBootstrap.mockResolvedValue({
      ok: true,
      status: 202,
      body: "accepted",
    });
  });

  it("allows replay when durable output is partial but bootstrap has failed", async () => {
    const { default: handler } = await import("../../api/tenants/bootstrap");

    authenticateRequest.mockResolvedValue({
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
    expect(triggerOnboardingBootstrap).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      accepted: true,
      gateway_status: 202,
      existing_output_present: true,
      hooks_repaired: false,
      bootstrap_status: "accepted",
    });
  });

  it("blocks replay while bootstrap is still in progress", async () => {
    const { default: handler } = await import("../../api/tenants/bootstrap");

    authenticateRequest.mockResolvedValue({
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
    expect(triggerOnboardingBootstrap).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      error: "Bootstrap is already in progress.",
      reason: "bootstrap_in_progress",
      bootstrap_status: "accepted",
      task_count: 0,
      competitor_count: 0,
      agent_updated_vault_count: 1,
    });
  });
});
