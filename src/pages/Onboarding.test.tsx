import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Onboarding from "./Onboarding";

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

type FetchResponseLike = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Onboarding />
    </MemoryRouter>
  );
}

describe("Onboarding flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates draft tenant on company step and moves to strategy step", async () => {
    const refreshTenant = vi.fn(async () => {});

    useAuthMock.mockReturnValue({
      user: { id: "user-1" },
      session: { access_token: "token-123" },
      tenant: null,
      loading: false,
      tenantLoading: false,
      refreshTenant,
      signOut: vi.fn(),
    });

    const fetchMock = vi.fn(async (input: string): Promise<FetchResponseLike> => {
      if (input === "/api/tenants") {
        return {
          ok: true,
          json: async () => ({ tenant: { status: "draft" } }),
        };
      }

      if (input === "/api/tenants/onboarding") {
        return {
          ok: true,
          json: async () => ({ onboarding_data: {} }),
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "not found" }),
      };
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    renderOnboarding();

    fireEvent.change(screen.getByLabelText(/Company name/i), {
      target: { value: "Acme Labs" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Continue to Strategy/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tenants",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tenants/onboarding",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Strategy setup")).toBeInTheDocument();
    });

    expect(refreshTenant).toHaveBeenCalled();
  });

  it("auto-saves step transitions and locks launch step into read-only summary once launch starts", async () => {
    const refreshTenant = vi.fn(async () => {});

    useAuthMock.mockReturnValue({
      user: { id: "user-1" },
      session: { access_token: "token-123" },
      tenant: {
        id: "tenant-1",
        name: "Acme Labs",
        status: "draft",
        onboarding_data: {
          company_name: "Acme Labs",
          mission_goals: "Increase qualified pipeline",
          products_services: ["Growth advisory"],
          starter_task: "Create a focused 14-day marketing plan.",
          agent_suggestions: [
            {
              id: "agent-1",
              role: "Chief of Staff",
              name: "Luna",
              focus: "Run weekly execution.",
            },
          ],
        },
      },
      loading: false,
      tenantLoading: false,
      refreshTenant,
      signOut: vi.fn(),
    });

    const fetchMock = vi.fn(async (input: string): Promise<FetchResponseLike> => {
      if (input === "/api/tenants/onboarding") {
        return {
          ok: true,
          json: async () => ({ onboarding_data: {} }),
        };
      }

      if (input === "/api/tenants/launch") {
        return {
          ok: true,
          json: async () => ({ status: "provisioning" }),
        };
      }

      if (input === "/api/tenants/status") {
        return {
          ok: true,
          json: async () => ({
            status: "provisioning",
            bootstrap_status: "accepted",
          }),
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "not found" }),
      };
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    renderOnboarding();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Continue to Launch/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Continue to Launch/i }));

    await waitFor(() => {
      expect(screen.getByText("Launch your dashboard")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Launch and Start Provisioning/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tenants/launch",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Provisioning status")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Refresh status/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Back$/i })).not.toBeInTheDocument();

    const launchCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/tenants/launch");
    expect(launchCalls).toHaveLength(1);

    const onboardingSaveCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/tenants/onboarding");
    expect(onboardingSaveCalls.length).toBeGreaterThanOrEqual(1);
  });
});
