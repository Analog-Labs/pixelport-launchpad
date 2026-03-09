import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchAgentHookMessage } from "../../api/lib/onboarding-bootstrap";

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
});
