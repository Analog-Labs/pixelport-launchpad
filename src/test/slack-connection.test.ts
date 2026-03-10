import { describe, expect, it } from "vitest";
import {
  deriveSlackConnection,
  getMissingSlackScopes,
  normalizeSlackScopes,
  REQUIRED_SLACK_BOT_SCOPES,
} from "../../api/lib/slack-connection";

describe("slack connection truth helpers", () => {
  it("normalizes scopes order-independently", () => {
    expect(normalizeSlackScopes(["chat:write", "im:read", "chat:write", " app_mentions:read "])).toEqual([
      "app_mentions:read",
      "chat:write",
      "im:read",
    ]);
  });

  it("reports the missing required scopes", () => {
    expect(getMissingSlackScopes(["app_mentions:read", "chat:write"])).toEqual(
      REQUIRED_SLACK_BOT_SCOPES.filter((scope) => !["app_mentions:read", "chat:write"].includes(scope))
    );
  });

  it("marks a connection as reauthorization required when scopes are incomplete", () => {
    const derived = deriveSlackConnection({
      team_id: "T1",
      team_name: "Analog",
      is_active: true,
      scopes: ["app_mentions:read", "chat:write"],
      connected_at: "2026-03-10T00:00:00.000Z",
      installer_user_id: "U1",
    });

    expect(derived.status).toBe("reauthorization_required");
    expect(derived.active).toBe(false);
    expect(derived.reauthorization_required).toBe(true);
    expect(derived.missing_scopes.length).toBeGreaterThan(0);
  });

  it("marks a scope-complete inactive connection as activating", () => {
    const derived = deriveSlackConnection({
      team_id: "T1",
      team_name: "Analog",
      is_active: false,
      scopes: [...REQUIRED_SLACK_BOT_SCOPES],
      connected_at: "2026-03-10T00:00:00.000Z",
      installer_user_id: "U1",
    });

    expect(derived.status).toBe("activating");
    expect(derived.active).toBe(false);
    expect(derived.missing_scopes).toEqual([]);
  });
});
