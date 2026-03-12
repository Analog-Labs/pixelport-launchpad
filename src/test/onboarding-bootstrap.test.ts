import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOnboardingBootstrapMessage,
  dispatchAgentHookMessage,
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
});

describe("buildOnboardingBootstrapMessage", () => {
  it("adds a native memory refresh requirement without rewriting the earlier contract", () => {
    const message = buildOnboardingBootstrapMessage({
      tenantName: "PixelPort QA",
      onboardingData: {
        agent_name: "Luna",
        goals: ["Grow pipeline"],
      },
    });

    expect(message).toContain('1. Mark any pending vault sections as "populating" before you work on them.');
    expect(message).toContain(
      '8. Valid task_type values are exactly: draft_content, research, competitor_analysis, strategy, report. If you need a running status, use "running" instead of "in_progress".',
    );
    expect(message).toContain(
      '9. After you materially update canonical vault truth, refresh the relevant native memory artifact in `MEMORY.md` or `memory/` during the same work cycle.',
    );
  });
});
