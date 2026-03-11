import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const upsertMock = vi.fn();
const fromMock = vi.fn(() => ({
  upsert: upsertMock,
}));

vi.mock("../../api/lib/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("inngest", () => ({
  Inngest: class {
    send = sendMock;
  },
}));

type MockResponse = {
  statusCode: number;
  body: unknown;
  redirectCode: number | null;
  redirectLocation: string | null;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  redirect: (code: number, location: string) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    body: null,
    redirectCode: null,
    redirectLocation: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    redirect(code: number, location: string) {
      this.redirectCode = code;
      this.redirectLocation = location;
      return this;
    },
  };
}

describe("GET /api/connections/slack/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SLACK_CLIENT_ID = "client-id";
    process.env.SLACK_CLIENT_SECRET = "client-secret";
    process.env.SLACK_STATE_SECRET = "state-secret";
    process.env.API_KEY_ENCRYPTION_KEY = "a".repeat(64);

    upsertMock.mockResolvedValue({ error: null });
    sendMock.mockResolvedValue(undefined);
  });

  it("uses the first forwarded proto token when redirecting with missing params", async () => {
    const { default: handler } = await import("../../api/connections/slack/callback");

    const req = {
      method: "GET",
      query: {},
      headers: {
        host: "pixelport-slack-qa-0310.loca.lt",
        "x-forwarded-proto": "https,http",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.redirectCode).toBe(302);
    expect(res.redirectLocation).toBe(
      "https://pixelport-slack-qa-0310.loca.lt/dashboard/connections?error=missing_params"
    );
  });

  it("uses the normalized https redirect_uri during Slack token exchange", async () => {
    const { createHmac } = await import("crypto");
    const { default: handler } = await import("../../api/connections/slack/callback");

    const payload = `tenant-1.${Date.now().toString(36)}`;
    const state = `${payload}.${createHmac("sha256", process.env.SLACK_STATE_SECRET!)
      .update(payload)
      .digest("hex")
      .slice(0, 32)}`;

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const params = new URLSearchParams(init?.body as string);
      expect(params.get("redirect_uri")).toBe(
        "https://pixelport-slack-qa-0310.loca.lt/api/connections/slack/callback"
      );

      return new Response(
        JSON.stringify({
          ok: true,
          access_token: "xoxb-test",
          team: { id: "T1", name: "Analog" },
          bot_user_id: "Ubot",
          authed_user: { id: "Uinstaller" },
          scope: "chat:write,im:read,im:write,im:history,app_mentions:read,channels:read,channels:history,users:read,groups:read,groups:history,files:read,files:write,reactions:write",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "GET",
      query: {
        code: "code-1",
        state,
      },
      headers: {
        host: "pixelport-slack-qa-0310.loca.lt",
        "x-forwarded-proto": "https,http",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(upsertMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith({
      name: "pixelport/slack.connected",
      data: { tenantId: "tenant-1" },
    });
    expect(res.redirectCode).toBe(302);
    expect(res.redirectLocation).toBe(
      "https://pixelport-slack-qa-0310.loca.lt/dashboard/connections?slack=connected"
    );
  });
});
