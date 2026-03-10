import { describe, expect, it } from "vitest";
import {
  buildSlackConfigObject,
  buildSlackWelcomeMessage,
  isSlackConfigCurrent,
  parseSlackConfigState,
  runtimeLogsSuggestSlackReady,
} from "../../api/lib/slack-activation";

describe("slack activation helpers", () => {
  it("builds the locked Slack config with configWrites disabled", () => {
    expect(buildSlackConfigObject("xoxb-test")).toEqual({
      enabled: true,
      botToken: "xoxb-test",
      appToken: "${SLACK_APP_TOKEN}",
      dmPolicy: "open",
      allowFrom: ["*"],
      replyToMode: "first",
      configWrites: false,
    });
  });

  it("parses config check output and recognizes the intended config", () => {
    const state = parseSlackConfigState(
      JSON.stringify({
        enabled: true,
        botTokenPresent: true,
        botTokenMatches: true,
        appTokenMatches: true,
        dmPolicy: "open",
        allowFromAll: true,
        replyToMode: "first",
        configWrites: false,
      })
    );

    expect(isSlackConfigCurrent(state)).toBe(true);
  });

  it("uses a broad log heuristic to decide when hot reload likely touched Slack", () => {
    expect(runtimeLogsSuggestSlackReady("Slack channel connected over websocket")).toBe(true);
    expect(runtimeLogsSuggestSlackReady("no relevant channel logs here")).toBe(false);
  });

  it("builds a concise welcome message", () => {
    expect(buildSlackWelcomeMessage("Luna")).toContain("I'm Luna");
    expect(buildSlackWelcomeMessage("Luna")).toContain("invite me there explicitly");
  });
});
