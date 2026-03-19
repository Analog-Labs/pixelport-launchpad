import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RuntimeHandoffResponse = {
  error?: string;
  paperclip_runtime_url?: string;
  workspace_launch_url?: string;
  handoff_token?: string;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function resolveWorkspaceUrl(rawUrl: unknown): string | null {
  const trimmed = readString(rawUrl).trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export default function Home() {
  const { session, tenant, refreshTenant } = useAuth();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const tenantStatus = tenant?.status || "unknown";
  const companyName = useMemo(() => {
    const fromOnboarding = readString(tenant?.onboarding_data?.company_name).trim();
    return fromOnboarding || tenant?.name || "your company";
  }, [tenant?.name, tenant?.onboarding_data]);

  const handleOpenWorkspace = async () => {
    setError("");

    if (!session?.access_token) {
      setError("Your session expired. Please sign in again.");
      return;
    }

    setLaunching(true);

    try {
      const res = await fetch("/api/runtime/handoff", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source: "dashboard-home" }),
      });

      const payload = (await res.json()) as RuntimeHandoffResponse;

      if (!res.ok) {
        throw new Error(payload.error || "Failed to prepare workspace launch.");
      }

      const workspaceUrl = resolveWorkspaceUrl(payload.workspace_launch_url);
      if (!workspaceUrl) {
        throw new Error("Workspace launch URL is unavailable. Please retry from onboarding.");
      }

      await refreshTenant();
      window.location.assign(workspaceUrl);
    } catch (launchError) {
      setError(
        launchError instanceof Error
          ? launchError.message
          : "Failed to open your workspace.",
      );
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Open Your Workspace</CardTitle>
          <CardDescription>
            Launchpad dashboard activity surfaces are retired. Continue in your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Tenant: {companyName}</p>
            <p className="mt-1">Status: {tenantStatus}</p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleOpenWorkspace} disabled={launching}>
              {launching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening workspace...
                </>
              ) : (
                <>
                  Open Workspace
                  <ExternalLink className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <Button variant="outline" asChild>
              <Link to="/onboarding">Back to Onboarding</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
