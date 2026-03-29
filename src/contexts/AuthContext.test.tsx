import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const { getSessionMock, onAuthStateChangeMock, signOutMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  signOutMock: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}));

function AuthProbe() {
  const { tenantLoading, tenantSyncState, tenantSyncError } = useAuth();

  return (
    <div>
      <p data-testid="tenant-loading">{tenantLoading ? "yes" : "no"}</p>
      <p data-testid="sync-state">{tenantSyncState}</p>
      <p data-testid="sync-error">{tenantSyncError ?? ""}</p>
    </div>
  );
}

function DoubleRefreshButton() {
  const { refreshTenant } = useAuth();
  return (
    <button
      type="button"
      onClick={() => {
        void refreshTenant({ lightweight: true });
        void refreshTenant({ lightweight: true });
      }}
    >
      Double refresh
    </button>
  );
}

function mockAuthenticatedSession() {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        access_token: "token-123",
        user: { id: "user-1" },
      },
    },
  });
}

describe("AuthProvider tenant refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChangeMock.mockImplementation(() => ({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("times out a hung tenant refresh and clears loading state", async () => {
    vi.useFakeTimers();
    mockAuthenticatedSession();

    global.fetch = vi.fn((_, init?: RequestInit) => {
      return new Promise((_, reject) => {
        const signal = init?.signal;
        if (!signal) {
          return;
        }

        const rejectAbort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal.aborted) {
          rejectAbort();
          return;
        }

        signal.addEventListener("abort", rejectAbort, { once: true });
      });
    }) as unknown as typeof fetch;

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(screen.getByTestId("tenant-loading")).toHaveTextContent("no");
    expect(screen.getByTestId("sync-state")).toHaveTextContent("error");
    expect(screen.getByTestId("sync-error")).toHaveTextContent("timed out");
  });

  it("dedupes concurrent lightweight refresh calls", async () => {
    vi.useFakeTimers();
    mockAuthenticatedSession();

    const fetchMock = vi.fn((input: string) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({
              id: "tenant-1",
              name: "Acme",
              status: "draft",
              onboarding_data: {},
              droplet_id: null,
              droplet_ip: null,
              litellm_team_id: null,
              agentmail_inbox: null,
              agent_api_key: null,
              plan: "trial",
              trial_ends_at: null,
              source: input,
            }),
          });
        }, 20);
      });
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AuthProvider>
        <AuthProbe />
        <DoubleRefreshButton />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(25);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Double refresh" }));

    await act(async () => {
      vi.advanceTimersByTime(25);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tenants/me");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/tenants/me?view=lightweight");
  });
});
