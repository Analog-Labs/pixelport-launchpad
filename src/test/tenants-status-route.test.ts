import { beforeEach, describe, expect, it, vi } from "vitest";
import { THIN_BRIDGE_CONTRACT_VERSION } from "../../api/lib/thin-bridge-contract";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const reconcileBootstrapState = vi.fn();
const getBootstrapState = vi.fn(() => ({
  status: "not_started",
  source: null,
  requested_at: null,
  accepted_at: null,
  completed_at: null,
  last_error: null,
}));
const tryRecoverProvisioningTenant = vi.fn(async (tenant: unknown) => ({
  tenant,
  recovered: false,
  reason: "test-bypass",
}));

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/bootstrap-state", () => ({
  reconcileBootstrapState,
  getBootstrapState,
}));

vi.mock("../../api/lib/provisioning-recovery", () => ({
  tryRecoverProvisioningTenant,
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
    expect(res.body).toEqual(expect.objectContaining({
      contract_version: THIN_BRIDGE_CONTRACT_VERSION,
      status: "active",
      bootstrap_status: "accepted",
      bootstrap_error: null,
      task_step_unlocked: true,
      has_agent_output: true,
      has_droplet: true,
      has_gateway: true,
      has_agentmail: false,
      trial_ends_at: null,
      plan: "trial",
    }));
    expect((res.body as { provisioning_progress?: { total_checks: number } }).provisioning_progress?.total_checks).toBeGreaterThanOrEqual(8);
  });

  it("unlocks task step when bootstrap is completed even if tenant status lags", async () => {
    const { default: handler } = await import("../../api/tenants/status");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-2",
        status: "provisioning",
        droplet_id: "droplet-2",
        gateway_token: "gw-2",
        agentmail_inbox: null,
        trial_ends_at: null,
        plan: "trial",
        onboarding_data: {},
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        updatedAt: "2026-03-22T17:00:00.000Z",
      },
      progress: {
        hasAgentOutput: true,
      },
      effectiveState: {
        status: "completed",
        last_error: null,
      },
      changed: true,
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      contract_version: THIN_BRIDGE_CONTRACT_VERSION,
      status: "provisioning",
      bootstrap_status: "completed",
      bootstrap_error: null,
      task_step_unlocked: true,
      has_agent_output: true,
      has_droplet: true,
      has_gateway: true,
      has_agentmail: false,
      trial_ends_at: null,
      plan: "trial",
    }));
    expect((res.body as { provisioning_progress?: { checks: Array<{ key: string; status: string }> } }).provisioning_progress?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "bootstrap_acknowledged", status: "completed" }),
      ])
    );
  });

  it("returns structured bootstrap error metadata when bootstrap has failed", async () => {
    const { default: handler } = await import("../../api/tenants/status");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-3",
        status: "provisioning",
        droplet_id: "droplet-3",
        gateway_token: "gw-3",
        agentmail_inbox: null,
        trial_ends_at: null,
        plan: "trial",
        onboarding_data: {},
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        updatedAt: "2026-03-23T06:00:00.000Z",
      },
      progress: {
        hasAgentOutput: false,
      },
      effectiveState: {
        status: "failed",
        last_error: "[missing_operator_scope] missing scope: operator.write",
      },
      changed: true,
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      contract_version: THIN_BRIDGE_CONTRACT_VERSION,
      status: "provisioning",
      bootstrap_status: "failed",
      bootstrap_error: {
        tag: "missing_operator_scope",
        retryable: false,
        message: "[missing_operator_scope] missing scope: operator.write",
        missing_scope: "operator.write",
        request_id: null,
      },
      task_step_unlocked: false,
      has_agent_output: false,
      has_droplet: true,
      has_gateway: true,
      has_agentmail: false,
      trial_ends_at: null,
      plan: "trial",
    }));
    expect((res.body as { provisioning_progress?: { checks: Array<{ key: string; status: string }> } }).provisioning_progress?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "bootstrap_acknowledged", status: "failed" }),
      ])
    );
  });

  it("falls back to persisted bootstrap state when reconciliation errors", async () => {
    const { default: handler } = await import("../../api/tenants/status");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-4",
        status: "provisioning",
        droplet_id: "droplet-4",
        gateway_token: "gw-4",
        agentmail_inbox: null,
        trial_ends_at: null,
        plan: "trial",
        onboarding_data: {
          bootstrap: {
            status: "failed",
            last_error: "[missing_operator_scope] missing scope: operator.write",
          },
        },
      },
    });
    reconcileBootstrapState.mockRejectedValue(new Error("Transient Supabase fetch failure"));
    getBootstrapState.mockReturnValue({
      status: "failed",
      source: "provisioning",
      requested_at: "2026-03-23T08:00:00.000Z",
      accepted_at: null,
      completed_at: null,
      last_error: "[missing_operator_scope] missing scope: operator.write",
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      contract_version: THIN_BRIDGE_CONTRACT_VERSION,
      status: "provisioning",
      bootstrap_status: "failed",
      bootstrap_error: {
        tag: "missing_operator_scope",
        retryable: false,
        message: "[missing_operator_scope] missing scope: operator.write",
        missing_scope: "operator.write",
        request_id: null,
      },
      task_step_unlocked: false,
      has_agent_output: false,
      has_droplet: true,
      has_gateway: true,
      has_agentmail: false,
      trial_ends_at: null,
      plan: "trial",
    }));
    expect((res.body as { provisioning_progress?: { current_check_key: string | null } }).provisioning_progress?.current_check_key).toBeTruthy();
  });

  it("projects knowledge_sync summary from onboarding_data.knowledge_mirror", async () => {
    const { default: handler } = await import("../../api/tenants/status");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-knowledge-status",
        status: "active",
        droplet_id: "droplet-k1",
        gateway_token: "gw-k1",
        agentmail_inbox: null,
        trial_ends_at: null,
        plan: "trial",
        onboarding_data: {
          knowledge_mirror: {
            revision: 4,
            sync: {
              status: "failed",
              synced_revision: 3,
              seeded_revision: 2,
              last_synced_at: "2026-03-26T18:00:00.000Z",
              last_error: "Runtime host unavailable",
              updated_at: "2026-03-26T18:05:00.000Z",
            },
          },
        },
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        updatedAt: "2026-03-26T18:10:00.000Z",
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
    expect(res.body).toEqual(
      expect.objectContaining({
        contract_version: THIN_BRIDGE_CONTRACT_VERSION,
        knowledge_sync: {
          status: "failed",
          revision: 4,
          synced_revision: 3,
          seeded_revision: 2,
          last_synced_at: "2026-03-26T18:00:00.000Z",
          last_error: "Runtime host unavailable",
          updated_at: "2026-03-26T18:05:00.000Z",
        },
      }),
    );
  });

  it("projects policy_apply summary from onboarding_data.approval_policy_runtime", async () => {
    const { default: handler } = await import("../../api/tenants/status");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-policy-status",
        status: "active",
        droplet_id: "droplet-p1",
        gateway_token: "gw-p1",
        agentmail_inbox: null,
        trial_ends_at: null,
        plan: "trial",
        onboarding_data: {
          approval_policy_runtime: {
            revision: 7,
            apply: {
              status: "failed",
              last_error: "Managed marker missing in TOOLS.md",
              last_applied_revision: 6,
              last_applied_at: "2026-03-27T20:00:00.000Z",
              updated_at: "2026-03-27T20:05:00.000Z",
            },
          },
        },
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        updatedAt: "2026-03-27T20:10:00.000Z",
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
    expect(res.body).toEqual(
      expect.objectContaining({
        contract_version: THIN_BRIDGE_CONTRACT_VERSION,
        policy_apply: {
          status: "failed",
          revision: 7,
          last_error: "Managed marker missing in TOOLS.md",
          last_applied_revision: 6,
          last_applied_at: "2026-03-27T20:00:00.000Z",
          updated_at: "2026-03-27T20:05:00.000Z",
        },
      }),
    );
  });

  it("returns policy_apply as null when no approval_policy_runtime exists yet", async () => {
    const { default: handler } = await import("../../api/tenants/status");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-policy-status-empty",
        status: "active",
        droplet_id: "droplet-p2",
        gateway_token: "gw-p2",
        agentmail_inbox: null,
        trial_ends_at: null,
        plan: "trial",
        onboarding_data: {
          company_name: "Legacy Tenant",
        },
      },
    });
    reconcileBootstrapState.mockResolvedValue({
      snapshot: {
        onboardingData: {},
        updatedAt: "2026-03-27T20:10:00.000Z",
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
    expect(res.body).toEqual(
      expect.objectContaining({
        contract_version: THIN_BRIDGE_CONTRACT_VERSION,
        policy_apply: null,
      }),
    );
  });
});
