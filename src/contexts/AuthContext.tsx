import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import {
  clearPixelportSessionState,
  getStoredPixelportUserId,
  hydratePixelportTenantState,
} from "@/lib/pixelport-storage";

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
  signOut: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  tenant: null,
  loading: true,
  tenantLoading: true,
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
  const [authInitialized, setAuthInitialized] = useState(false);

  const applySessionState = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setAuthInitialized(true);
    setLoading(false);

    if (!nextSession?.user) {
      setTenant(null);
      setTenantLoading(false);
      clearPixelportSessionState();
      return;
    }

    setTenantLoading(true);
  };

  const refreshTenant = async () => {
    if (!authInitialized) {
      return;
    }

    if (!session?.access_token || !session.user) {
      setTenant(null);
      setTenantLoading(false);
      return;
    }

    const storedUserId = getStoredPixelportUserId();
    if (storedUserId && storedUserId !== session.user.id) {
      clearPixelportSessionState();
    }

    setTenantLoading(true);

    try {
      const res = await fetch("/api/tenants/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const tenantData = (await res.json()) as TenantProfile;
        setTenant(tenantData);
        hydratePixelportTenantState(session.user.id, tenantData);
        return;
      }

      if (res.status === 404) {
        setTenant(null);
        clearPixelportSessionState();
        return;
      }

      console.error("Failed to fetch tenant state:", await res.text());
      setTenant(null);
    } catch (error) {
      console.error("Tenant lookup error:", error);
      setTenant(null);
    } finally {
      setTenantLoading(false);
    }
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

    void refreshTenant();
  }, [authInitialized, session?.access_token, session?.user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearPixelportSessionState();
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, tenant, loading, tenantLoading, signOut, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  );
};
