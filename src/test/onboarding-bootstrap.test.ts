import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOnboardingBootstrapMessage,
  deriveHooksToken,
  dispatchAgentHookMessage,
  triggerOnboardingBootstrap,
} from "../../api/lib/onboarding-bootstrap";

describe("dispatchAgentHookMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes transport failures into a failed dispatch result", async () => {
    const timeoutError = new TypeError("fetch failed", {
      cause: {
        message: "Connect Timeout Error",
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));

    const result = await dispatchAgentHookMessage({
      gatewayUrl: "http://127.0.0.1:18789",
      gatewayToken: "gw-token",
      name: "Smoke",
      message: "No-op",
    });

    expect(result).toEqual({
      ok: false,
      status: 504,
      body: "fetch failed: Connect Timeout Error",
    });
  });

  it("dispatches to hook URL with compatibility auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: vi.fn().mockResolvedValue("accepted"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchAgentHookMessage({
      gatewayUrl: "http://127.0.0.1:18789/",
      gatewayToken: "gw-token",
      name: "Smoke",
      message: "No-op",
      hookPath: "/hooks/agent",
    });

    const expectedHookToken = deriveHooksToken("gw-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `http://127.0.0.1:18789/hooks/agent?token=${expectedHookToken}`,
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Authorization: `Bearer ${expectedHookToken}`,
        "x-openclaw-token": expectedHookToken,
      },
    });
    expect(result).toEqual({
      ok: true,
      status: 202,
      body: "accepted",
    });
  });

  it("retries /hooks/agent with gateway token when derived token is unauthorized", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("accepted", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await triggerOnboardingBootstrap({
      gatewayUrl: "http://127.0.0.1:18789",
      gatewayToken: "gw-token",
      message: "Start",
      agentId: "main",
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      body: "accepted",
    });
    const expectedHookToken = deriveHooksToken("gw-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `http://127.0.0.1:18789/hooks/agent?token=${expectedHookToken}`,
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://127.0.0.1:18789/hooks/agent?token=gw-token");
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer gw-token",
      "x-openclaw-token": "gw-token",
    });
  });

  it("falls back to mapped onboarding hook path when /hooks/agent is unavailable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("Method not allowed", { status: 405 }))
      .mockResolvedValueOnce(new Response("accepted", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await triggerOnboardingBootstrap({
      gatewayUrl: "http://127.0.0.1:18789",
      gatewayToken: "gw-token",
      message: "Start",
      agentId: "main",
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      body: "accepted",
    });
    const expectedHookToken = deriveHooksToken("gw-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `http://127.0.0.1:18789/hooks/agent?token=${expectedHookToken}`,
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `http://127.0.0.1:18789/hooks/onboarding-bootstrap?token=${expectedHookToken}`,
    );
  });

  it("retries mapped hook path with gateway token when mapped derived token is unauthorized", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("Method not allowed", { status: 405 }))
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("accepted", { status: 202 }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await triggerOnboardingBootstrap({
      gatewayUrl: "http://127.0.0.1:18789",
      gatewayToken: "gw-token",
      message: "Start",
      agentId: "main",
    });

    expect(result).toEqual({
      ok: true,
      status: 202,
      body: "accepted",
    });

    const expectedHookToken = deriveHooksToken("gw-token");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `http://127.0.0.1:18789/hooks/agent?token=${expectedHookToken}`,
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `http://127.0.0.1:18789/hooks/onboarding-bootstrap?token=${expectedHookToken}`,
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "http://127.0.0.1:18789/hooks/onboarding-bootstrap?token=gw-token",
    );
  });
});

describe("buildOnboardingBootstrapMessage", () => {
  it("requires workspace-first durable writes and native memory refresh", () => {
    const message = buildOnboardingBootstrapMessage({
      tenantName: "PixelPort QA",
      onboardingData: {
        agent_name: "Luna",
        goals: ["Grow pipeline"],
      },
    });

    expect(message).toContain('1. Mark any pending vault sections as "populating" before you work on them.');
    expect(message).toContain(
      "3. Write concrete findings into canonical workspace artifacts under `pixelport/` (vault snapshots, runtime snapshots, and deliverables).",
    );
    expect(message).toContain(
      '5. After you materially update canonical truth, refresh the relevant native memory artifact in `MEMORY.md` or `memory/` during the same work cycle.',
    );
    expect(message).not.toContain("/api/agent/");
  });
});
