import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Connections from "./Connections";

const { useAuthMock, toastMock, refreshTenantMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  toastMock: vi.fn(),
  refreshTenantMock: vi.fn(async () => {}),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("Connections page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshTenantMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      session: {
        access_token: "token-1",
      },
      tenant: {
        status: "active",
        onboarding_data: {
          approval_policy: {
            mode: "balanced",
            guardrails: {
              publish: true,
              paid_spend: true,
              outbound_messages: true,
              major_strategy_changes: true,
            },
          },
        },
      },
      refreshTenant: refreshTenantMock,
    });
  });

  it("shows reconnect state truthfully and starts Slack install via POST", async () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: assignMock },
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/connections") {
        return jsonResponse({
          integrations: {
            slack: {
              connected: true,
              active: false,
              status: "reauthorization_required",
              team_name: "Analog",
              missing_scopes: ["im:read", "im:write"],
              reauthorization_required: true,
            },
            email: {
              connected: true,
              inbox: "hello@agentmail.test",
            },
          },
        });
      }

      if (url === "/api/tenants/status") {
        return jsonResponse({
          policy_apply: {
            status: "applied",
            revision: 4,
            last_error: null,
            last_applied_revision: 4,
            last_applied_at: "2026-03-27T20:00:00.000Z",
            updated_at: "2026-03-27T20:00:00.000Z",
          },
        });
      }

      if (url === "/api/connections/slack/install") {
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual(
          expect.objectContaining({
            Authorization: "Bearer token-1",
          })
        );
        return jsonResponse({
          authorize_url: "https://slack.com/oauth/v2/authorize?client_id=test",
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <Connections />
      </MemoryRouter>
    );

    await screen.findByText("Reconnect required for Analog");
    expect(screen.getByText("Missing scopes: im:read, im:write")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reconnect Slack" }));

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("https://slack.com/oauth/v2/authorize?client_id=test");
    });
  });

  it("allows governance edit and save with expected revision guard", async () => {
    const onboardingCalls: Array<Record<string, unknown>> = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/connections") {
        return jsonResponse({
          integrations: {
            slack: {
              connected: false,
              active: false,
              status: "not_connected",
            },
            email: {
              connected: true,
              inbox: "hello@agentmail.test",
            },
          },
        });
      }

      if (url === "/api/tenants/status") {
        return jsonResponse({
          policy_apply: {
            status: "applied",
            revision: 4,
            last_error: null,
            last_applied_revision: 4,
            last_applied_at: "2026-03-27T20:00:00.000Z",
            updated_at: "2026-03-27T20:00:00.000Z",
          },
        });
      }

      if (url === "/api/tenants/onboarding") {
        onboardingCalls.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
        return jsonResponse({
          success: true,
          policy_apply: {
            status: "applied",
            revision: 5,
            last_error: null,
            last_applied_revision: 5,
            last_applied_at: "2026-03-27T21:00:00.000Z",
            updated_at: "2026-03-27T21:00:00.000Z",
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <Connections />
      </MemoryRouter>
    );

    await screen.findByText("Governance");

    fireEvent.click(screen.getByRole("button", { name: "Edit Governance" }));
    fireEvent.click(screen.getByRole("button", { name: /^Strict/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save Governance" }));

    await waitFor(() => {
      expect(onboardingCalls).toHaveLength(1);
    });

    expect(onboardingCalls[0]).toEqual(
      expect.objectContaining({
        approval_policy_expected_revision: 4,
        approval_policy: expect.objectContaining({
          mode: "strict",
        }),
      }),
    );
    expect(refreshTenantMock).toHaveBeenCalled();
  });

  it("shows failed governance status and triggers retry apply", async () => {
    const onboardingCalls: Array<Record<string, unknown>> = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/connections") {
        return jsonResponse({
          integrations: {
            slack: {
              connected: false,
              active: false,
              status: "not_connected",
            },
            email: {
              connected: true,
              inbox: "hello@agentmail.test",
            },
          },
        });
      }

      if (url === "/api/tenants/status") {
        return jsonResponse({
          policy_apply: {
            status: "failed",
            revision: 7,
            last_error: "Managed marker missing in TOOLS.md",
            last_applied_revision: 6,
            last_applied_at: "2026-03-27T20:00:00.000Z",
            updated_at: "2026-03-27T20:05:00.000Z",
          },
        });
      }

      if (url === "/api/tenants/onboarding") {
        onboardingCalls.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
        return jsonResponse({
          success: true,
          policy_apply: {
            status: "pending",
            revision: 7,
            last_error: null,
            last_applied_revision: 6,
            last_applied_at: "2026-03-27T20:00:00.000Z",
            updated_at: "2026-03-27T21:00:00.000Z",
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <Connections />
      </MemoryRouter>
    );

    await screen.findByText("Retry Apply");
    expect(screen.getAllByText("Managed marker missing in TOOLS.md").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry Apply" }));

    await waitFor(() => {
      expect(onboardingCalls).toHaveLength(1);
    });

    expect(onboardingCalls[0]).toEqual({
      force_policy_apply: true,
      approval_policy_expected_revision: 7,
    });
  });
});
