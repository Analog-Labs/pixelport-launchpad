import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Connections from "./Connections";

const { useAuthMock, toastMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  toastMock: vi.fn(),
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
    useAuthMock.mockReturnValue({
      session: {
        access_token: "token-1",
      },
      tenant: {
        status: "active",
      },
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
});
