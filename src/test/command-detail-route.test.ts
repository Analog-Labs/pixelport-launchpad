import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const getCommandById = vi.fn();
const listCommandEvents = vi.fn();
const listWorkspaceEventsForCommand = vi.fn();
const getVaultRefreshStaleMetadataForCommand = vi.fn();

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/commands", () => ({
  getCommandById,
  listCommandEvents,
  listWorkspaceEventsForCommand,
}));

vi.mock("../../api/lib/vault-refresh-recovery", () => ({
  getVaultRefreshStaleMetadataForCommand,
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

describe("GET /api/commands/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the command detail with additive stale metadata", async () => {
    const { default: handler } = await import("../../api/commands/[id]");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
      },
      userId: "user-1",
    });
    getCommandById.mockResolvedValue({
      id: "cmd-stale",
      tenant_id: "tenant-1",
      command_type: "vault_refresh",
      status: "dispatched",
    });
    listCommandEvents.mockResolvedValue([{ event_type: "dispatched" }]);
    listWorkspaceEventsForCommand.mockResolvedValue([]);
    getVaultRefreshStaleMetadataForCommand.mockResolvedValue({
      is_stale: true,
      reason: "target_ready_after_activity",
      summary: "Vault refresh stalled",
    });

    const req = {
      method: "GET",
      query: {
        id: "cmd-stale",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getVaultRefreshStaleMetadataForCommand).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      command: expect.objectContaining({
        id: "cmd-stale",
      }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      command: expect.objectContaining({
        id: "cmd-stale",
      }),
      events: [{ event_type: "dispatched" }],
      workspace_events: [],
      stale: expect.objectContaining({
        is_stale: true,
        reason: "target_ready_after_activity",
      }),
    });
  });
});
