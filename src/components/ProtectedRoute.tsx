import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PixelPortLogo from "@/components/PixelPortLogo";
import { getRequestedDashboardPath } from "@/lib/dashboard-redirect";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, tenant, loading, tenantLoading } = useAuth();
  const location = useLocation();
  const requestedPath = getRequestedDashboardPath(location.pathname, location.search, location.hash);

  if (loading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <PixelPortLogo className="h-10 w-10 animate-pulse" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: requestedPath }} />;
  }

  if (!tenant) {
    return <Navigate to="/onboarding" replace state={{ from: requestedPath }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
