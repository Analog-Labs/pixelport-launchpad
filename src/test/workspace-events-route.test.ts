import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateAgentRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const getCommandById = vi.fn();
const insertWorkspaceEvent = vi.fn();
const maybeAdvanceCommandFromRuntimeEvent = vi.fn();
const appendCommandEvent = vi.fn();

vi.mock("../../api/lib/auth", () => ({
  authenticateAgentRequest,
  errorResponse,
}));

vi.mock("../../api/lib/commands", () => ({
  appendCommandEvent,
  getCommandById,
  insertWorkspaceEvent,
  maybeAdvanceCommandFromRuntimeEvent,
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

describe("POST /api/agent/workspace-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ingests a command lifecycle event and returns the updated command", async () => {
    const { default: handler } = await import("../../api/agent/workspace-events");

    authenticateAgentRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
      },
    });
    getCommandById.mockResolvedValue({
      id: "cmd-1",
      tenant_id: "tenant-1",
      status: "dispatched",
      last_error: null,
    });
    insertWorkspaceEvent.mockResolvedValue({
      duplicate: false,
      event: {
        id: "evt-row-1",
        command_id: "cmd-1",
        event_id: "evt-1",
        event_type: "command.running",
        entity_type: "command",
        entity_id: "cmd-1",
        occurred_at: "2026-03-08T12:00:00.000Z",
      },
    });
    maybeAdvanceCommandFromRuntimeEvent.mockResolvedValue({
      id: "cmd-1",
      tenant_id: "tenant-1",
      status: "running",
      last_error: null,
    });
    appendCommandEvent.mockResolvedValue({});

    const req = {
      method: "POST",
      body: {
        event_id: "evt-1",
        event_type: "command.running",
        command_id: "cmd-1",
        entity_type: "command",
        entity_id: "cmd-1",
        payload: {
          summary: "Execution started",
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(201);
    expect(appendCommandEvent).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      duplicate: false,
      event: expect.objectContaining({
        event_id: "evt-1",
      }),
      command: expect.objectContaining({
        id: "cmd-1",
        status: "running",
      }),
    });
  });
});
