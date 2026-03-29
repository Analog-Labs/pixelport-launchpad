import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import {
  clearPixelportSessionState,
  getStoredPixelportUserId,
  hydratePixelportTenantState,
} from "@/lib/pixelport-storage";

type TenantRefreshOptions = {
  lightweight?: boolean;
  force?: boolean;
};

type TenantSyncState = "idle" | "syncing" | "error";

export interface TenantProfile {
  id: string;
  name: string;
  status: string;
  onboarding_data: Record<string, unknown> | null;
  droplet_id: string | null;
  droplet_ip: string | null;
  litellm_team_id: string | null;
  agentmail_inbox: string | null;
  agent_api_key: string | null;
  plan: string;
  trial_ends_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  tenant: TenantProfile | null;
  loading: boolean;
  tenantLoading: boolean;
  tenantSyncState: TenantSyncState;
  tenantSyncError: string | null;
  signOut: () => Promise<void>;
  refreshTenant: (options?: TenantRefreshOptions) => Promise<void>;
}

const TENANT_REFRESH_TIMEOUT_MS = 10_000;

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  tenant: null,
  loading: true,
  tenantLoading: true,
  tenantSyncState: "idle",
  tenantSyncError: null,
  signOut: async () => {},
  refreshTenant: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantSyncState, setTenantSyncState] = useState<TenantSyncState>("idle");
  const [tenantSyncError, setTenantSyncError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const refreshInFlightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);

  const buildTenantEndpoint = (lightweight: boolean): string =>
    lightweight ? "/api/tenants/me?view=lightweight" : "/api/tenants/me";

  const applySessionState = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setAuthInitialized(true);
    setLoading(false);

    if (!nextSession?.user) {
      setTenant(null);
      setTenantLoading(false);
      setTenantSyncState("idle");
      setTenantSyncError(null);
      clearPixelportSessionState();
      return;
    }

    setTenantLoading(true);
  };

  const refreshTenant = async (options?: TenantRefreshOptions) => {
    if (!authInitialized) {
      return;
    }

    const lightweight = options?.lightweight === true;
    const requestKey = lightweight ? "lightweight" : "full";

    if (!options?.force) {
      let inFlight = refreshInFlightRef.current;
      if (inFlight) {
        if (inFlight.key === requestKey) {
          return inFlight.promise;
        }

        await inFlight.promise;
      }

      inFlight = refreshInFlightRef.current;
      if (inFlight?.key === requestKey) {
        return inFlight.promise;
      }
    }

    let refreshPromise: Promise<void>;

    refreshPromise = (async () => {
      if (!authInitialized) {
        return;
      }

      if (!session?.access_token || !session.user) {
        setTenant(null);
        setTenantLoading(false);
        setTenantSyncState("idle");
        setTenantSyncError(null);
        return;
      }

      const storedUserId = getStoredPixelportUserId();
      if (storedUserId && storedUserId !== session.user.id) {
        clearPixelportSessionState();
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TENANT_REFRESH_TIMEOUT_MS);

      setTenantLoading(true);
      setTenantSyncState("syncing");
      setTenantSyncError(null);

      try {
        const res = await fetch(buildTenantEndpoint(lightweight), {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
        });

        if (res.ok) {
          const tenantData = (await res.json()) as TenantProfile;
          setTenant(tenantData);
          hydratePixelportTenantState(session.user.id, tenantData);
          setTenantSyncState("idle");
          setTenantSyncError(null);
          return;
        }

        if (res.status === 404) {
          setTenant(null);
          clearPixelportSessionState();
          setTenantSyncState("idle");
          setTenantSyncError(null);
          return;
        }

        console.error("Failed to fetch tenant state:", await res.text());
        setTenantSyncState("error");
        setTenantSyncError("Could not sync workspace state. You can keep working and retry.");
      } catch (error) {
        console.error("Tenant lookup error:", error);
        const timedOut = error instanceof DOMException && error.name === "AbortError";
        setTenantSyncState("error");
        setTenantSyncError(
          timedOut
            ? "Workspace sync timed out. You can keep working and retry."
            : "Could not sync workspace state. You can keep working and retry."
        );
      } finally {
        clearTimeout(timeoutId);
        setTenantLoading(false);
      }
    })().finally(() => {
      if (refreshInFlightRef.current?.promise === refreshPromise) {
        refreshInFlightRef.current = null;
      }
    });

    refreshInFlightRef.current = {
      key: requestKey,
      promise: refreshPromise,
    };

    return refreshPromise;
  };

  useEffect(() => {
    // Set up listener BEFORE getSession per Supabase best practices
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySessionState(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySessionState(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authInitialized) {
      return;
    }

    // Keep session bootstrap refresh lightweight so onboarding UI doesn't sit in long-running sync state.
    void refreshTenant({ lightweight: true });
  }, [authInitialized, session?.access_token, session?.user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearPixelportSessionState();
    setTenant(null);
    setTenantSyncState("idle");
    setTenantSyncError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        tenant,
        loading,
        tenantLoading,
        tenantSyncState,
        tenantSyncError,
        signOut,
        refreshTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
