import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface SlackInfo {
  connected: boolean;
  team_name?: string;
  connected_at?: string;
}

interface EmailInfo {
  connected: boolean;
  inbox: string | null;
}

const Connections = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [slack, setSlack] = useState<SlackInfo>({ connected: false });
  const [email, setEmail] = useState<EmailInfo>({ connected: false, inbox: null });
  const [connecting, setConnecting] = useState(false);

  // Fetch integration status
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/connections", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSlack(data.integrations?.slack || { connected: false });
          setEmail(data.integrations?.email || { connected: false, inbox: null });
        }
      } catch (err) {
        console.error("Failed to fetch connections:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConnections();
  }, [session]);

  // Handle OAuth callback query params
  useEffect(() => {
    const slackParam = searchParams.get("slack");
    const errorParam = searchParams.get("error");

    if (slackParam === "connected") {
      toast({
        title: "Slack connected!",
        description: "Your agent is being activated in your Slack workspace.",
      });
      setSlack((prev) => ({ ...prev, connected: true }));
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

  const handleConnectSlack = () => {
    setConnecting(true);
    window.location.href = `/api/connections/slack/install?token=${session?.access_token}`;
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
      {(!slack.connected || !(email.connected && email.inbox)) && (
        <div className="border border-border bg-card rounded-lg p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Loader2 className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Setup in progress</p>
            <p className="text-xs text-muted-foreground">Connect your tools to get the most out of your AI Chief of Staff.</p>
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
              {slack.connected ? (
                <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>Connected{slack.team_name ? ` to ${slack.team_name}` : ""}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Connect Slack to chat with your agent directly in your workspace.
                </p>
              )}
            </div>
            {!slack.connected && (
              <Button onClick={handleConnectSlack} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  "Connect Slack"
                )}
              </Button>
            )}
          </div>

          {slack.connected && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">What happens next?</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  Your agent is now active in your Slack workspace
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  DM your agent directly or mention it in any channel
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">→</span>
                  Content drafts will be sent to you in Slack for approval
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
