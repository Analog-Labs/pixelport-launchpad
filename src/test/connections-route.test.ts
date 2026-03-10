import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const getPublicRegistry = vi.fn(() => []);
const fromMock = vi.fn();

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("../../api/lib/integrations/registry", () => ({
  getPublicRegistry,
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

describe("GET /api/connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        agentmail_inbox: "hello@agentmail.test",
      },
      userId: "user-1",
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "slack_connections") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  team_id: "T1",
                  team_name: "Analog",
                  is_active: true,
                  connected_at: "2026-03-10T00:00:00.000Z",
                  scopes: ["app_mentions:read", "chat:write"],
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "integrations") {
        return {
          select: () => ({
            eq: async () => ({
              data: [],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("returns additive Slack truth fields including reauthorization state", async () => {
    const { default: handler } = await import("../../api/connections/index");
    const req = {
      method: "GET",
      headers: {
        authorization: "Bearer token-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      integrations: expect.objectContaining({
        slack: expect.objectContaining({
          connected: true,
          active: false,
          status: "reauthorization_required",
          reauthorization_required: true,
          missing_scopes: expect.arrayContaining(["im:read", "im:write"]),
        }),
        email: {
          connected: true,
          inbox: "hello@agentmail.test",
        },
      }),
      registry: [],
    });
  });
});
