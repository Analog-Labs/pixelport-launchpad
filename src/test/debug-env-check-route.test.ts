import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("GET /api/debug/env-check", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.API_KEY_ENCRYPTION_KEY = "debug-secret";
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;
  });

  it("returns 404 when NODE_ENV is production", async () => {
    process.env.NODE_ENV = "production";

    const { default: handler } = await import("../../api/debug/env-check");
    const req = { method: "GET", headers: { "x-debug-secret": "debug-secret" }, query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("returns 404 when VERCEL_ENV is production", async () => {
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "production";

    const { default: handler } = await import("../../api/debug/env-check");
    const req = { method: "GET", headers: { "x-debug-secret": "debug-secret" }, query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("returns 401 when x-debug-secret header is missing or invalid", async () => {
    const { default: handler } = await import("../../api/debug/env-check");
    const req = { method: "GET", headers: {}, query: { secret: "debug-secret" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns env diagnostics when x-debug-secret is valid", async () => {
    process.env.PAPERCLIP_HANDOFF_SECRET = "handoff-secret";

    const { default: handler } = await import("../../api/debug/env-check");
    const req = { method: "GET", headers: { "x-debug-secret": "debug-secret" }, query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);

    const body = res.body as {
      missing: string[];
      details: Array<{ name: string; status: string }>;
    };

    expect(body.details.some((entry) => entry.name === "PAPERCLIP_HANDOFF_SECRET")).toBe(true);
    expect(body.missing).not.toContain("PAPERCLIP_RUNTIME_URL");
  });
});
