import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCipheriv, randomBytes } from "crypto";
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
      groupPolicy: "open",
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
        groupPolicy: "open",
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

  it("treats tenants without explicit channel policy as stale", () => {
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

    expect(isSlackConfigCurrent(state)).toBe(false);
  });

  it("builds a concise welcome message", () => {
    expect(buildSlackWelcomeMessage("Luna")).toContain("I'm Luna");
    expect(buildSlackWelcomeMessage("Luna")).toContain("invite me there explicitly");
  });
});

describe("activateSlack welcome DM behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.SUPABASE_PROJECT_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.API_KEY_ENCRYPTION_KEY = "a".repeat(64);
    process.env.SSH_PRIVATE_KEY = "test-key";
    process.env.SLACK_APP_TOKEN = "xapp-test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps activation successful when the welcome DM response is not valid JSON", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "tenants") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: "tenant-1",
                  slug: "bootstrap-truth-qa-20260310054029",
                  status: "active",
                  droplet_ip: "142.93.117.18",
                  onboarding_data: { agent_name: "Luna" },
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "slack_connections") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  tenant_id: "tenant-1",
                  team_id: "TS7V7KT35",
                  team_name: "Analog",
                  bot_token: encryptSlackToken("xoxb-test"),
                  is_active: false,
                  scopes: [
                    "app_mentions:read",
                    "channels:history",
                    "channels:read",
                    "chat:write",
                    "files:read",
                    "files:write",
                    "groups:history",
                    "groups:read",
                    "im:history",
                    "im:read",
                    "im:write",
                    "reactions:write",
                    "users:read",
                  ],
                  installer_user_id: "Uinstaller",
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        from: fromMock,
      })),
    }));

    vi.doMock("inngest", () => ({
      Inngest: class {
        createFunction(_config: unknown, _trigger: unknown, handler: unknown) {
          return handler;
        }
      },
    }));

    vi.doMock("../../api/lib/bootstrap-state", () => ({
      reconcileBootstrapState: vi.fn(async () => ({
        effectiveState: { status: "completed" },
      })),
    }));

    vi.doMock("../../api/lib/droplet-ssh", () => ({
      sshExec: vi.fn(async () =>
        JSON.stringify({
          enabled: true,
          botTokenPresent: true,
          botTokenMatches: true,
          appTokenMatches: true,
          dmPolicy: "open",
          groupPolicy: "open",
          allowFromAll: true,
          replyToMode: "first",
          configWrites: false,
        })
      ),
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "http://142.93.117.18:18789/") {
        return new Response("ok", { status: 200 });
      }

      if (url === "https://slack.com/api/chat.postMessage") {
        return new Response("<html>500</html>", {
          status: 500,
          headers: {
            "Content-Type": "text/html",
          },
        });
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("AbortSignal", {
      timeout: vi.fn(() => undefined),
    });
    vi.stubGlobal("fetch", fetchMock);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { activateSlack } = await import("../../api/inngest/functions/activate-slack");

    const step = {
      run: async (_name: string, fn: () => Promise<unknown>) => await fn(),
      sleep: vi.fn(async () => undefined),
    };

    const result = await activateSlack({
      event: { data: { tenantId: "tenant-1" } },
      step,
    } as never);

    expect(result).toMatchObject({
      success: true,
      tenantId: "tenant-1",
      welcomeDm: {
        sent: false,
        skipped: false,
        error: expect.stringContaining("Unexpected token"),
      },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "Slack welcome DM threw",
      expect.objectContaining({
        tenantId: "tenant-1",
        error: expect.any(Error),
      })
    );
  });
});

function encryptSlackToken(token: string): string {
  const key = Buffer.from(process.env.API_KEY_ENCRYPTION_KEY!, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}
