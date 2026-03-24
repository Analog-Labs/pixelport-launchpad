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
  it("requires workspace-first durable writes and native memory refresh", () => {
    const message = buildOnboardingBootstrapMessage({
      tenantName: "PixelPort QA",
      onboardingData: {
        agent_name: "Luna",
        goals: ["Grow pipeline"],
        starter_task: "Ship weekly growth report",
      },
    });

    expect(message).toContain('1. Mark any pending vault sections as "populating" before you work on them.');
    expect(message).toContain(
      "3. Write concrete findings into canonical workspace artifacts under `pixelport/` (vault snapshots, runtime snapshots, and deliverables).",
    );
    expect(message).toContain(
      "5. After you materially update canonical truth, write the memory update into today's `memory/YYYY-MM-DD.md` note (PARA workspace memory contract).",
    );
    expect(message).toContain("Starter task from onboarding: Ship weekly growth report");
    expect(message).not.toContain("/api/agent/");
  });
});
