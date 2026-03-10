import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateAgentRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
);
const syncBootstrapStateAfterAgentWrite = vi.fn();
const from = vi.fn();

vi.mock("../../api/lib/auth", () => ({
  authenticateAgentRequest,
  errorResponse,
}));

vi.mock("../../api/lib/bootstrap-state", () => ({
  syncBootstrapStateAfterAgentWrite,
}));

vi.mock("../../api/lib/supabase", () => ({
  supabase: {
    from,
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

function mockInsertSingle(table: string, row: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  from.mockImplementationOnce((name: string) => {
    expect(name).toBe(table);
    return { insert };
  });
}

function mockUpdateSingle(table: string, row: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn(() => ({ single }));
  const eqSection = vi.fn(() => ({ select }));
  const eqTenant = vi.fn(() => ({ eq: eqSection }));
  const update = vi.fn(() => ({ eq: eqTenant }));
  from.mockImplementationOnce((name: string) => {
    expect(name).toBe(table);
    return { update };
  });
}

describe("agent write routes bootstrap sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateAgentRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
      },
    });
  });

  it("syncs bootstrap state after a task write", async () => {
    const { default: handler } = await import("../../api/agent/tasks");
    mockInsertSingle("agent_tasks", { id: "task-1", tenant_id: "tenant-1" });

    const req = {
      method: "POST",
      body: {
        agent_role: "Chief of Staff",
        task_type: "research",
        task_description: "Research positioning",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(201);
    expect(syncBootstrapStateAfterAgentWrite).toHaveBeenCalledWith({
      tenantId: "tenant-1",
    });
  });

  it("syncs bootstrap state after a competitor write", async () => {
    const { default: handler } = await import("../../api/agent/competitors");
    mockInsertSingle("competitors", { id: "comp-1", tenant_id: "tenant-1" });

    const req = {
      method: "POST",
      body: {
        company_name: "Example Competitor",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(201);
    expect(syncBootstrapStateAfterAgentWrite).toHaveBeenCalledWith({
      tenantId: "tenant-1",
    });
  });

  it("syncs bootstrap state after a vault write", async () => {
    const { default: handler } = await import("../../api/agent/vault/[key]");
    mockUpdateSingle("vault_sections", {
      id: "vault-1",
      tenant_id: "tenant-1",
      section_key: "brand_voice",
    });

    const req = {
      method: "PUT",
      query: {
        key: "brand_voice",
      },
      body: {
        content: "Updated content",
        status: "ready",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(syncBootstrapStateAfterAgentWrite).toHaveBeenCalledWith({
      tenantId: "tenant-1",
    });
  });
});
