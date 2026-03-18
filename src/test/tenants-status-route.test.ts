import { beforeEach, describe, expect, it, vi } from "vitest";
import { THIN_BRIDGE_CONTRACT_VERSION } from "../../api/lib/thin-bridge-contract";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const reconcileBootstrapState = vi.fn();

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/bootstrap-state", () => ({
  reconcileBootstrapState,
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

describe("GET /api/tenants/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns truthful in-progress bootstrap state for partial-output tenants", async () => {
    const { default: handler } = await import("../../api/tenants/status");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        status: "active",
        droplet_id: "droplet-1",
        gateway_token: "gw-1",
        litellm_team_id: "team-1",
        agentmail_inbox: null,
        trial_ends_at: null,
        plan: "trial",
        onboarding_data: {},
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        updatedAt: "2026-03-10T10:00:00.000Z",
      },
      progress: {
        hasAgentOutput: true,
      },
      effectiveState: {
        status: "accepted",
        last_error: null,
      },
      changed: true,
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      contract_version: THIN_BRIDGE_CONTRACT_VERSION,
      status: "active",
      bootstrap_status: "accepted",
      task_step_unlocked: true,
      has_agent_output: true,
      has_droplet: true,
      has_gateway: true,
      has_litellm: true,
      has_agentmail: false,
      trial_ends_at: null,
      plan: "trial",
    });
  });
});
