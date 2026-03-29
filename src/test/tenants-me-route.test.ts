import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  }),
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

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/bootstrap-state", () => ({
  reconcileBootstrapState,
  getBootstrapState,
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

describe("GET /api/tenants/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 for non-GET methods", async () => {
    const { default: handler } = await import("../../api/tenants/me");
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: "Method not allowed" });
  });

  it("returns tenant payload when bootstrap reconciliation errors", async () => {
    const { default: handler } = await import("../../api/tenants/me");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        supabase_user_id: "user-1",
        name: "Acme",
        slug: "acme",
        plan: "trial",
        status: "active",
        droplet_id: "droplet-1",
        droplet_ip: "203.0.113.10",
        gateway_token: "gw-secret",
        litellm_team_id: null,
        agentmail_inbox: null,
        agent_api_key: "agent-secret",
        paperclip_company_id: "company-1",
        paperclip_api_key: "paperclip-secret",
        onboarding_data: {
          mission_goals: "Grow pipeline",
          bootstrap: {
            status: "accepted",
          },
        },
        settings: {},
        trial_ends_at: null,
        created_at: "2026-03-20T10:00:00.000Z",
        updated_at: "2026-03-23T08:00:00.000Z",
      },
    });
    reconcileBootstrapState.mockRejectedValue(new Error("Transient Supabase fetch failure"));

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(errorResponse).not.toHaveBeenCalled();
    expect(getBootstrapState).toHaveBeenCalledTimes(1);
    expect(reconcileBootstrapState).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({
      id: "tenant-1",
      status: "active",
      onboarding_data: {
        mission_goals: "Grow pipeline",
        bootstrap: {
          status: "accepted",
        },
      },
      updated_at: "2026-03-23T08:00:00.000Z",
    });
    expect((res.body as Record<string, unknown>).gateway_token).toBeUndefined();
    expect((res.body as Record<string, unknown>).agent_api_key).toBeUndefined();
    expect((res.body as Record<string, unknown>).paperclip_api_key).toBeUndefined();
  });

  it("skips bootstrap reconciliation in lightweight mode", async () => {
    const { default: handler } = await import("../../api/tenants/me");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-2",
        supabase_user_id: "user-2",
        name: "Beta",
        slug: "beta",
        plan: "trial",
        status: "draft",
        droplet_id: null,
        droplet_ip: null,
        gateway_token: "gw-secret",
        litellm_team_id: null,
        agentmail_inbox: null,
        agent_api_key: "agent-secret",
        paperclip_company_id: null,
        paperclip_api_key: "paperclip-secret",
        onboarding_data: {
          company_name: "Beta",
          bootstrap: {
            status: "accepted",
          },
        },
        settings: {},
        trial_ends_at: null,
        created_at: "2026-03-20T10:00:00.000Z",
        updated_at: "2026-03-24T10:00:00.000Z",
      },
    });

    const req = { method: "GET", query: { view: "lightweight" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(reconcileBootstrapState).not.toHaveBeenCalled();
    expect(getBootstrapState).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      id: "tenant-2",
      onboarding_data: {
        company_name: "Beta",
        bootstrap: {
          status: "accepted",
        },
      },
      updated_at: "2026-03-24T10:00:00.000Z",
    });
  });
});
