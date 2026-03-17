import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  }),
);

vi.mock("../../api/lib/auth", () => ({
  authenticateRequest,
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

describe("POST /api/runtime/handoff", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.PAPERCLIP_HANDOFF_SECRET;
    delete process.env.PAPERCLIP_HANDOFF_TTL_SECONDS;
  });

  it("returns 405 for non-POST methods", async () => {
    const { default: handler } = await import("../../api/runtime/handoff");
    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: "Method not allowed" });
  });

  it("returns 503 when required handoff env vars are missing", async () => {
    const { default: handler } = await import("../../api/runtime/handoff");
    authenticateRequest.mockResolvedValue({
      userId: "user-1",
      tenant: {
        id: "tenant-1",
        slug: "tenant-slug",
        name: "Tenant",
        status: "active",
        plan: "trial",
      },
    });
    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: "Paperclip runtime handoff is not configured.",
      missing: ["PAPERCLIP_HANDOFF_SECRET"],
    });
    expect(authenticateRequest).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when tenant has no droplet runtime target", async () => {
    process.env.PAPERCLIP_HANDOFF_SECRET = "secret-value";

    const { default: handler } = await import("../../api/runtime/handoff");
    authenticateRequest.mockResolvedValue({
      userId: "user-1",
      tenant: {
        id: "tenant-1",
        slug: "tenant-slug",
        name: "Tenant",
        status: "active",
        plan: "trial",
        droplet_ip: null,
      },
    });

    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: "Paperclip runtime target unavailable for this tenant.",
      code: "runtime-target-unavailable",
    });
  });

  it("returns 409 when tenant droplet_ip is invalid", async () => {
    process.env.PAPERCLIP_HANDOFF_SECRET = "secret-value";

    const { default: handler } = await import("../../api/runtime/handoff");
    authenticateRequest.mockResolvedValue({
      userId: "user-1",
      tenant: {
        id: "tenant-1",
        slug: "tenant-slug",
        name: "Tenant",
        status: "active",
        plan: "trial",
        droplet_ip: "invalid-host",
      },
    });

    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: "Paperclip runtime target unavailable for this tenant.",
      code: "runtime-target-unavailable",
    });
  });

  it("returns 409 when tenant is not runtime-handoff ready", async () => {
    process.env.PAPERCLIP_HANDOFF_SECRET = "secret-value";

    const { default: handler } = await import("../../api/runtime/handoff");

    authenticateRequest.mockResolvedValue({
      userId: "user-1",
      tenant: {
        id: "tenant-1",
        slug: "tenant-slug",
        name: "Tenant",
        status: "provisioning",
        plan: "trial",
        droplet_ip: "157.245.253.88",
      },
    });

    const req = { method: "POST", body: { source: "launch-dashboard" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: "Tenant is not ready for Paperclip runtime handoff.",
      status: "provisioning",
    });
  });

  it("returns signed handoff token when tenant is ready", async () => {
    process.env.PAPERCLIP_HANDOFF_SECRET = "secret-value";
    process.env.PAPERCLIP_HANDOFF_TTL_SECONDS = "120";

    const { default: handler } = await import("../../api/runtime/handoff");

    authenticateRequest.mockResolvedValue({
      userId: "user-1",
      tenant: {
        id: "tenant-1",
        slug: "tenant-slug",
        name: "Tenant",
        status: "active",
        plan: "trial",
        droplet_ip: "157.245.253.88",
      },
    });

    const req = { method: "POST", body: { source: "onboarding_launch" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);

    const payload = res.body as Record<string, unknown>;
    expect(payload.contract_version).toBe("p1-v1");
    expect(payload.paperclip_runtime_url).toBe("http://157.245.253.88:18789");
    expect(typeof payload.handoff_token).toBe("string");
    expect(typeof payload.expires_at).toBe("string");
    expect(payload.source).toBe("onboarding_launch");
    expect(payload.user_id).toBe("user-1");
    expect(payload.tenant).toEqual({
      id: "tenant-1",
      slug: "tenant-slug",
      name: "Tenant",
      status: "active",
      plan: "trial",
    });

    const token = payload.handoff_token as string;
    const segments = token.split(".");
    expect(segments).toHaveLength(2);
    expect(segments[0].length).toBeGreaterThan(0);
    expect(segments[1].length).toBeGreaterThan(0);
  });

  it("routes unexpected errors through errorResponse", async () => {
    process.env.PAPERCLIP_HANDOFF_SECRET = "secret-value";

    const { default: handler } = await import("../../api/runtime/handoff");

    const failingError = new Error("auth exploded");
    authenticateRequest.mockRejectedValue(failingError);

    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(errorResponse).toHaveBeenCalledTimes(1);
    expect(errorResponse).toHaveBeenCalledWith(res, failingError);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "auth exploded" });
  });
});
