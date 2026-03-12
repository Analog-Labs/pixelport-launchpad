import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateAgentRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  }),
);

vi.mock("../../api/lib/auth", () => ({
  authenticateAgentRequest,
  errorResponse,
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

describe("agent memory route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.MEM0_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty disabled payload for GET when Mem0 is off for the tenant", async () => {
    const { default: handler } = await import("../../api/agent/memory");
    authenticateAgentRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        settings: {
          memory_mem0_enabled: false,
        },
      },
    });

    const req = {
      method: "GET",
      query: {
        q: "brand voice",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      enabled: false,
      provider: "mem0",
      status: "disabled",
      query: "brand voice",
      results: [],
    });
  });

  it("returns 409 for writes when Mem0 is off for the tenant", async () => {
    const { default: handler } = await import("../../api/agent/memory");
    authenticateAgentRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        settings: {
          memory_mem0_enabled: false,
        },
      },
    });

    const req = {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "Remember this" }],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: "Mem0 is disabled for this tenant",
      code: "mem0_disabled",
      enabled: false,
      provider: "mem0",
    });
  });

  it("returns 503 for GET when Mem0 is enabled but the global key is missing", async () => {
    const { default: handler } = await import("../../api/agent/memory");
    authenticateAgentRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        settings: {
          memory_mem0_enabled: true,
        },
      },
    });

    const req = {
      method: "GET",
      query: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: "Mem0 is currently unavailable",
      code: "mem0_unavailable",
      enabled: true,
      provider: "mem0",
      memories: [],
    });
  });

  it("passes through to Mem0 when the tenant enables it and the key is configured", async () => {
    process.env.MEM0_API_KEY = "mem0-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [{ id: "mem-1", memory: "Brand voice note" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: handler } = await import("../../api/agent/memory");
    authenticateAgentRequest.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        settings: {
          memory_mem0_enabled: true,
        },
      },
    });

    const req = {
      method: "GET",
      query: {
        q: "brand voice",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      results: [{ id: "mem-1", memory: "Brand voice note" }],
    });
  });
});
