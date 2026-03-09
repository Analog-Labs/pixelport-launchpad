import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const getActiveCommandByType = vi.fn();
const getCommandByIdempotencyKey = vi.fn();
const getActiveCommandByTarget = vi.fn();
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
  getActiveCommandByType,
  getActiveCommandByTarget,
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
    getActiveCommandByType.mockResolvedValue(null);
    getActiveCommandByTarget.mockResolvedValue(null);
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
      reuse_reason: "idempotency_key",
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

  it("reuses an active vault_refresh command for the same section", async () => {
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
    getActiveCommandByType.mockResolvedValue({
      id: "cmd-active",
      tenant_id: "tenant-1",
      status: "running",
      command_type: "vault_refresh",
      target_entity_type: "vault_section",
      target_entity_id: "company_profile",
    });

    const req = {
      method: "POST",
      body: {
        command_type: "vault_refresh",
        target_entity_type: "vault_section",
        target_entity_id: "company_profile",
        idempotency_key: "vault-refresh:tenant-1:company_profile:attempt-2",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(createCommandRecord).not.toHaveBeenCalled();
    expect(dispatchAgentHookMessage).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      idempotent: false,
      reuse_reason: "active_target",
      command: expect.objectContaining({
        id: "cmd-active",
        status: "running",
      }),
    });
  });

  it("reuses an active vault_refresh command for another section in the same tenant", async () => {
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
    getActiveCommandByType.mockResolvedValue({
      id: "cmd-active-company",
      tenant_id: "tenant-1",
      status: "acknowledged",
      command_type: "vault_refresh",
      target_entity_type: "vault_section",
      target_entity_id: "company_profile",
    });

    const req = {
      method: "POST",
      body: {
        command_type: "vault_refresh",
        target_entity_type: "vault_section",
        target_entity_id: "brand_voice",
        idempotency_key: "vault-refresh:tenant-1:brand_voice:attempt-2",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(createCommandRecord).not.toHaveBeenCalled();
    expect(dispatchAgentHookMessage).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      idempotent: false,
      reuse_reason: "active_command_type",
      command: expect.objectContaining({
        id: "cmd-active-company",
        status: "acknowledged",
        target_entity_id: "company_profile",
      }),
    });
  });

  it("canonicalizes vault_refresh commands from the typed target", async () => {
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
      id: "cmd-vault",
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
      id: "cmd-vault",
      tenant_id: "tenant-1",
      status: "dispatched",
    });

    const req = {
      method: "POST",
      body: {
        command_type: "vault_refresh",
        target_entity_type: "vault_section",
        target_entity_id: "company_profile",
        idempotency_key: "vault-refresh:tenant-1:company_profile:attempt-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createCommandRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: "vault_refresh",
        title: "Refresh Company Profile with Chief",
        targetEntityType: "vault_section",
        targetEntityId: "company_profile",
        payload: {
          section_key: "company_profile",
          section_title: "Company Profile",
          snapshot_path: "pixelport/vault/snapshots/company_profile.md",
        },
      })
    );
    expect(dispatchAgentHookMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "PixelPort Command: Refresh Company Profile with Chief",
        message: expect.stringContaining('entity_id "company_profile"'),
      })
    );
    expect(res.statusCode).toBe(201);
  });

  it("rejects invalid vault_refresh section targets", async () => {
    const { default: handler } = await import("../../api/commands/index");

    authenticateRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
      },
      userId: "user-1",
    });

    const req = {
      method: "POST",
      body: {
        command_type: "vault_refresh",
        target_entity_type: "vault_section",
        target_entity_id: "bad-section",
        idempotency_key: "vault-refresh:tenant-1:bad-section:attempt-1",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(createCommandRecord).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      error: "vault_refresh requires a valid target_entity_id vault section key",
    });
  });
});
