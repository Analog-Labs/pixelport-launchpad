import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Vault from "./Vault";

const { toastMock, useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  toastMock: {
    error: vi.fn(),
    message: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/lib/avatars", () => ({
  getAgentName: () => "Luna",
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function byTextContent(text: string) {
  return (_content: string, node: Element | null) => node?.textContent === text;
}

const readySections = [
  {
    id: "section-1",
    section_key: "company_profile",
    section_title: "Company Profile",
    content: "Existing **company** profile",
    status: "ready",
    last_updated_by: "agent",
  },
  {
    id: "section-2",
    section_key: "brand_voice",
    section_title: "Brand Voice",
    content: "Direct and practical.",
    status: "ready",
    last_updated_by: "agent",
  },
];

describe("Vault page", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();

    useAuthMock.mockReturnValue({
      session: {
        access_token: "token-1",
      },
      tenant: {
        id: "tenant-1",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts a refresh and shows inline failure state without hiding existing content", async () => {
    let vaultCalls = 0;
    let commandCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/vault") {
        vaultCalls += 1;

        if (vaultCalls === 1) {
          return jsonResponse(readySections);
        }

        return jsonResponse([
          {
            ...readySections[0],
            status: "ready",
          },
          readySections[1],
        ]);
      }

      if (url === "/api/commands?limit=10") {
        return jsonResponse({
          commands: [],
        });
      }

      if (url === "/api/commands" && init?.method === "POST") {
        return jsonResponse(
          {
            idempotent: false,
            command: {
              id: "cmd-1",
              status: "dispatched",
              last_error: null,
            },
          },
          201
        );
      }

      if (url === "/api/commands/cmd-1") {
        commandCalls += 1;

        if (commandCalls === 1) {
          return jsonResponse({
            command: {
              id: "cmd-1",
              status: "running",
              last_error: null,
            },
            events: [{ message: "Chief is refreshing the section." }],
            workspace_events: [
              {
                payload: {
                  summary: "Chief is refreshing the section.",
                },
              },
            ],
          });
        }

        return jsonResponse({
          command: {
            id: "cmd-1",
            status: "failed",
            last_error: "Chief could not verify the update",
          },
          events: [{ message: "Chief could not verify the update" }],
          workspace_events: [
            {
              payload: {
                error: "Chief could not verify the update",
              },
            },
          ],
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<Vault />);

    await screen.findByText("Knowledge Vault");
    expect(screen.getAllByText(byTextContent("Existing company profile")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /Refresh with Chief/i })[0]);

    await screen.findByText("Chief is refreshing");
    expect(screen.getAllByText(byTextContent("Existing company profile")).length).toBeGreaterThan(0);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 8200));
    });

    await screen.findByText("Refresh failed");
    expect(screen.getByText("Chief could not verify the update")).toBeInTheDocument();
    expect(screen.getAllByText(byTextContent("Existing company profile")).length).toBeGreaterThan(0);
    expect(toastMock.error).toHaveBeenCalledWith("Chief could not verify the update");
  }, 12000);

  it("hydrates a stored active refresh after reload and clears it after completion", async () => {
    localStorage.setItem(
      "pixelport_active_vault_refresh_commands",
      JSON.stringify({
        "tenant-1:company_profile": "cmd-stored",
      })
    );

    let vaultCalls = 0;
    let commandCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/vault") {
        vaultCalls += 1;

        if (vaultCalls === 1) {
          return jsonResponse(readySections);
        }

        return jsonResponse([
          {
            ...readySections[0],
            content: "Refreshed **company** profile",
            status: "ready",
          },
          readySections[1],
        ]);
      }

      if (url === "/api/commands?limit=10") {
        return jsonResponse({
          commands: [
            {
              id: "cmd-stored",
              command_type: "vault_refresh",
              target_entity_type: "vault_section",
              target_entity_id: "company_profile",
              status: "running",
              last_error: null,
            },
          ],
        });
      }

      if (url === "/api/commands/cmd-stored") {
        commandCalls += 1;

        if (commandCalls === 1) {
          return jsonResponse({
            command: {
              id: "cmd-stored",
              status: "running",
              last_error: null,
            },
            events: [{ message: "Chief resumed the section refresh." }],
            workspace_events: [
              {
                payload: {
                  summary: "Chief resumed the section refresh.",
                },
              },
            ],
          });
        }

        return jsonResponse({
          command: {
            id: "cmd-stored",
            status: "completed",
            last_error: null,
          },
          events: [{ message: "Section refresh completed." }],
          workspace_events: [
            {
              payload: {
                summary: "Section refresh completed.",
              },
            },
          ],
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<Vault />);

    await screen.findByText("Knowledge Vault");
    await screen.findByText("Chief is refreshing");
    expect(screen.getAllByText(byTextContent("Existing company profile")).length).toBeGreaterThan(0);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 4100));
    });

    await waitFor(() => {
      expect(screen.queryByText("Chief is refreshing")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByText(byTextContent("Refreshed company profile")).length).toBeGreaterThan(0);
    });
    expect(localStorage.getItem("pixelport_active_vault_refresh_commands")).toBe("{}");
    expect(toastMock.success).toHaveBeenCalledWith("Company Profile refreshed");
  }, 12000);

  it("reuses the tenant's active refresh and disables refresh across other sections", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/vault") {
        return jsonResponse(readySections);
      }

      if (url === "/api/commands?limit=10") {
        return jsonResponse({
          commands: [],
        });
      }

      if (url === "/api/commands" && init?.method === "POST") {
        return jsonResponse({
          idempotent: false,
          reuse_reason: "active_command_type",
          command: {
            id: "cmd-existing",
            status: "running",
            last_error: null,
            target_entity_id: "company_profile",
          },
        });
      }

      if (url === "/api/commands/cmd-existing") {
        return jsonResponse({
          command: {
            id: "cmd-existing",
            status: "running",
            last_error: null,
          },
          events: [{ message: "Chief is refreshing the section." }],
          workspace_events: [
            {
              payload: {
                summary: "Chief is refreshing the section.",
              },
            },
          ],
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<Vault />);

    await screen.findByText("Knowledge Vault");

    fireEvent.click(screen.getAllByRole("button", { name: /Refresh with Chief/i })[1]);

    await screen.findByText("Chief is refreshing");
    expect(
      JSON.parse(localStorage.getItem("pixelport_active_vault_refresh_commands") ?? "{}")
    ).toEqual({
      "tenant-1:company_profile": "cmd-existing",
    });

    for (const button of screen.getAllByRole("button", { name: /Refresh with Chief/i })) {
      expect(button).toBeDisabled();
    }

    expect(toastMock.message).toHaveBeenCalledWith(
      "Another vault refresh is already running for Company Profile"
    );
  });
});
