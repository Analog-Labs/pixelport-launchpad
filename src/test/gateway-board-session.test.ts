import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardSessionProxyError, proxyToPaperclipAsBoard } from "../../api/lib/gateway";

type MockHeaders = {
  get: (name: string) => string | null;
  getSetCookie?: () => string[];
};

function createResponse(params: {
  status: number;
  body?: string;
  headers?: MockHeaders;
}): Response {
  return {
    status: params.status,
    ok: params.status >= 200 && params.status < 300,
    text: async () => params.body ?? "",
    headers:
      (params.headers as unknown as Headers) ??
      ({
        get: () => null,
      } as unknown as Headers),
  } as Response;
}

describe("proxyToPaperclipAsBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PAPERCLIP_HANDOFF_SECRET;
  });

  it("forwards all handoff cookies to board-session API calls", async () => {
    process.env.PAPERCLIP_HANDOFF_SECRET = "handoff-secret";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          status: 302,
          headers: {
            get: () => null,
            getSetCookie: () => [
              "better-auth.csrf=csrf-token; Path=/; HttpOnly",
              "better-auth.session_token=session-token; Path=/; HttpOnly",
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          status: 200,
          body: '{"ok":true}',
          headers: {
            get: () => "application/json",
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyToPaperclipAsBoard(
      {
        id: "tenant-1",
        slug: "tenant",
        name: "Tenant",
        status: "active",
        plan: "trial",
        droplet_ip: "127.0.0.1",
      } as never,
      "user-1",
      "/api/approvals/ap-1/approve",
      { method: "POST", body: { approved: true } },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[1].headers.Cookie).toContain("better-auth.csrf=csrf-token");
    expect(secondCall[1].headers.Cookie).toContain("better-auth.session_token=session-token");
  });

  it("retries board auth once when first board-session call returns 403", async () => {
    process.env.PAPERCLIP_HANDOFF_SECRET = "handoff-secret";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          status: 302,
          headers: {
            get: () => null,
            getSetCookie: () => ["better-auth.session_token=session-v1; Path=/"],
          },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          status: 403,
          body: '{"error":"Board access required"}',
          headers: {
            get: () => "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          status: 302,
          headers: {
            get: () => null,
            getSetCookie: () => ["better-auth.session_token=session-v2; Path=/"],
          },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          status: 200,
          body: '{"status":"approved"}',
          headers: {
            get: () => "application/json",
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyToPaperclipAsBoard(
      {
        id: "tenant-1",
        slug: "tenant",
        name: "Tenant",
        status: "active",
        plan: "trial",
        droplet_ip: "127.0.0.1",
      } as never,
      "user-1",
      "/api/approvals/ap-1/reject",
      { method: "POST", body: { reason: "no" } },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("throws a board-session config error when handoff env is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      proxyToPaperclipAsBoard(
        {
          id: "tenant-1",
          slug: "tenant",
          name: "Tenant",
          status: "active",
          plan: "trial",
          droplet_ip: "127.0.0.1",
        } as never,
        "user-1",
        "/api/approvals/ap-1/approve",
        { method: "POST", body: {} },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<BoardSessionProxyError>>({
        code: "handoff_not_configured",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
