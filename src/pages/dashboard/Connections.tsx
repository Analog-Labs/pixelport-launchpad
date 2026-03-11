import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface SlackInfo {
  connected: boolean;
  active: boolean;
  status: "not_connected" | "reauthorization_required" | "activating" | "active";
  team_name?: string;
  connected_at?: string;
  missing_scopes?: string[];
  reauthorization_required?: boolean;
}

interface EmailInfo {
  connected: boolean;
  inbox: string | null;
}

const Connections = () => {
  const { session, tenant } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [slack, setSlack] = useState<SlackInfo>({
    connected: false,
    active: false,
    status: "not_connected",
    missing_scopes: [],
    reauthorization_required: false,
  });
  const [email, setEmail] = useState<EmailInfo>({ connected: false, inbox: null });
  const [connecting, setConnecting] = useState(false);
  const provisioningComplete = tenant?.status === "active";
  const slackReady = slack.status === "active";
  const slackNeedsReconnect = slack.status === "reauthorization_required";

  const fetchConnections = async () => {
    try {
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/connections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSlack(
          data.integrations?.slack || {
            connected: false,
            active: false,
            status: "not_connected",
            missing_scopes: [],
            reauthorization_required: false,
          }
        );
        setEmail(data.integrations?.email || { connected: false, inbox: null });
      }
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch integration status
  useEffect(() => {
    void fetchConnections();
  }, [session]);

  // Handle OAuth callback query params
  useEffect(() => {
    const slackParam = searchParams.get("slack");
    const errorParam = searchParams.get("error");

    if (slackParam === "connected") {
      toast({
        title: "Slack connected!",
        description: "Slack is connected. Activation is running on your tenant now.",
      });
      setSlack((prev) => ({
        ...prev,
        connected: true,
        active: false,
        status: "activating",
      }));
      void fetchConnections();
      setSearchParams({}, { replace: true });
    } else if (errorParam) {
      toast({
        title: "Connection failed",
        description: `Slack returned an error: ${errorParam}`,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const handleConnectSlack = async () => {
    if (!session?.access_token) return;

    setConnecting(true);
    try {
      const response = await fetch("/api/connections/slack/install", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json();
      if (!response.ok || !payload?.authorize_url) {
        throw new Error(payload?.error || "Failed to start Slack install");
      }

      window.location.assign(payload.authorize_url);
    } catch (error) {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to start Slack install.",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Manage your integrations. Connect tools to let your agent work across platforms.
        </p>
      </header>

      {/* Setup Progress Banner */}
      {((!slackReady) || !(email.connected && email.inbox)) && (
        <div className="border border-border bg-card rounded-lg p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Loader2 className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Setup in progress</p>
            <p className="text-xs text-muted-foreground">
              {provisioningComplete
                ? slackNeedsReconnect
                  ? "Slack needs a reconnect with the latest permissions before the Chief can be live in workspace conversations."
                  : "Connect your tools to get the most out of your AI Chief of Staff."
                : "Provisioning must finish before Slack can be connected."}
            </p>
          </div>
        </div>
      )}

      {/* Slack */}
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#4A154B]">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Slack</p>
              {slack.status === "active" ? (
                <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>Connected{slack.team_name ? ` to ${slack.team_name}` : ""}</span>
                </div>
              ) : slack.status === "activating" ? (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connected{slack.team_name ? ` to ${slack.team_name}` : ""}, activation in progress</span>
                </div>
              ) : slack.status === "reauthorization_required" ? (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <RefreshCw className="h-4 w-4" />
                  <span>Reconnect required{slack.team_name ? ` for ${slack.team_name}` : ""}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Connect Slack to chat with your agent directly in your workspace.
                </p>
              )}
            </div>
            {slack.status !== "active" && (
              <Button onClick={handleConnectSlack} disabled={connecting || !provisioningComplete || slack.status === "activating"}>
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : !provisioningComplete ? (
                  "Available After Provisioning"
                ) : slackNeedsReconnect ? (
                  "Reconnect Slack"
                ) : slack.status === "activating" ? (
                  "Activation Running"
                ) : (
                  "Connect Slack"
                )}
              </Button>
            )}
          </div>

          {slack.status === "not_connected" && !provisioningComplete && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Slack activation depends on the tenant droplet and gateway being online first. Finish provisioning, then connect Slack here.
              </p>
            </div>
          )}

          {slack.status === "reauthorization_required" && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">Reconnect required</p>
              <p className="text-sm text-muted-foreground">
                The Slack app permissions were expanded for the current Chief behavior. Reconnect this workspace so the Chief can reply in DMs and invited channels truthfully.
              </p>
              {slack.missing_scopes && slack.missing_scopes.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Missing scopes: {slack.missing_scopes.join(", ")}
                </p>
              )}
            </div>
          )}

          {slack.status === "activating" && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">What happens next?</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">→</span>
                  PixelPort is patching the tenant runtime and verifying the Slack connection.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">→</span>
                  The first welcome DM is sent only after tenant readiness and Slack activation both complete.
                </li>
              </ul>
            </div>
          )}

          {slack.status === "active" && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">What happens next?</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  Your Chief is live in Slack
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  DM your Chief directly at any time
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  Invite your Chief into a channel when you want help there
                </li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.open("https://app.slack.com", "_blank")}
              >
                Open Slack
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">Email</p>
            {email.connected && email.inbox ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15 border-0">Active</Badge>
                <span className="truncate">— {email.inbox}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Email is automatically set up when your agent is provisioned.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Connections;
