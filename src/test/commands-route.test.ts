import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const getCommandByIdempotencyKey = vi.fn();
const createCommandRecord = vi.fn();
const appendCommandEvent = vi.fn();
const updateCommandStatus = vi.fn();
const listCommands = vi.fn();
const dispatchAgentHookMessage = vi.fn();

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
  errorResponse,
}));

vi.mock("../../api/lib/commands", () => ({
  appendCommandEvent,
  createCommandRecord,
  getCommandByIdempotencyKey,
  listCommands,
  updateCommandStatus,
}));

vi.mock("../../api/lib/onboarding-bootstrap", () => ({
  dispatchAgentHookMessage,
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

describe("POST /api/commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates and dispatches a new command", async () => {
    const { default: handler } = await import("../../api/commands/index");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        droplet_ip: "127.0.0.1",
        gateway_token: "gw-token",
      },
      userId: "user-1",
    });
    getCommandByIdempotencyKey.mockResolvedValue(null);
    createCommandRecord.mockResolvedValue({
      id: "cmd-1",
      tenant_id: "tenant-1",
      status: "pending",
    });
    appendCommandEvent.mockResolvedValue({});
    dispatchAgentHookMessage.mockResolvedValue({
      ok: true,
      status: 202,
      body: "accepted",
    });
    updateCommandStatus.mockResolvedValue({
      id: "cmd-1",
      tenant_id: "tenant-1",
      status: "dispatched",
    });

    const req = {
      method: "POST",
      body: {
        command_type: "content_refresh",
        title: "Refresh homepage",
        instructions: "Audit and tighten the copy.",
        idempotency_key: "refresh-homepage-1",
        payload: { priority: "high" },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(201);
    expect(dispatchAgentHookMessage).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      idempotent: false,
      command: expect.objectContaining({
        id: "cmd-1",
        status: "dispatched",
      }),
    });
  });

  it("returns the existing command on idempotency hit without redispatching", async () => {
    const { default: handler } = await import("../../api/commands/index");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
      },
      userId: "user-1",
    });
    getCommandByIdempotencyKey.mockResolvedValue({
      id: "cmd-existing",
      tenant_id: "tenant-1",
      status: "dispatched",
    });

    const req = {
      method: "POST",
      body: {
        command_type: "content_refresh",
        title: "Refresh homepage",
        instructions: "Audit and tighten the copy.",
        idempotency_key: "refresh-homepage-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(dispatchAgentHookMessage).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      idempotent: true,
      command: expect.objectContaining({
        id: "cmd-existing",
      }),
    });
  });

  it("marks the command failed and returns 502 when hook dispatch transport fails", async () => {
    const { default: handler } = await import("../../api/commands/index");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        droplet_ip: "127.0.0.1",
        gateway_token: "gw-token",
      },
      userId: "user-1",
    });
    getCommandByIdempotencyKey.mockResolvedValue(null);
    createCommandRecord.mockResolvedValue({
      id: "cmd-timeout",
      tenant_id: "tenant-1",
      status: "pending",
    });
    appendCommandEvent.mockResolvedValue({});
    dispatchAgentHookMessage.mockResolvedValue({
      ok: false,
      status: 504,
      body: "fetch failed: Connect Timeout Error",
    });
    updateCommandStatus.mockResolvedValue({
      id: "cmd-timeout",
      tenant_id: "tenant-1",
      status: "failed",
      last_error: "fetch failed: Connect Timeout Error",
    });

    const req = {
      method: "POST",
      body: {
        command_type: "release_smoke",
        title: "Foundation smoke",
        instructions: "No-op smoke test only.",
        idempotency_key: "foundation-smoke-timeout-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(updateCommandStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStatus: "failed",
        lastError: "fetch failed: Connect Timeout Error",
      })
    );
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      error: "Runtime hook rejected the command dispatch",
      command: expect.objectContaining({
        id: "cmd-timeout",
        status: "failed",
      }),
      gateway_status: 504,
    });
  });
});
