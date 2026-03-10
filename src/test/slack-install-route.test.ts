import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const errorResponse = vi.fn((res: MockResponse, error: unknown) =>
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error",
  })
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

describe("POST /api/connections/slack/install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SLACK_CLIENT_ID = "client-id";
    process.env.API_KEY_ENCRYPTION_KEY = "a".repeat(64);
    delete process.env.SLACK_REDIRECT_URI;

    authenticateRequest.mockResolvedValue({
      tenant: { id: "tenant-1" },
      userId: "user-1",
    });
  });

  it("returns a Slack authorize URL for authenticated POST requests", async () => {
    const { default: handler } = await import("../../api/connections/slack/install");

    const req = {
      method: "POST",
      headers: {
        authorization: "Bearer token-1",
        host: "pixelport-launchpad.vercel.app",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      authorize_url: expect.stringContaining("https://slack.com/oauth/v2/authorize"),
    });
    expect(res.body).toEqual({
      authorize_url: expect.stringContaining(
        encodeURIComponent("https://pixelport-launchpad.vercel.app/api/connections/slack/callback")
      ),
    });
  });

  it("rejects the old GET install path", async () => {
    const { default: handler } = await import("../../api/connections/slack/install");

    const req = { method: "GET", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(authenticateRequest).not.toHaveBeenCalled();
  });
});
