import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Search, MessageSquare, ArrowRight } from "lucide-react";
import { getAvatarConfig, getAgentName, getAgentAvatarId } from "@/lib/avatars";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getFirstName(user: ReturnType<typeof useAuth>["user"]): string {
  const full = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (full) return full.split(" ")[0];
  return user?.email?.split("@")[0] || "there";
}

const AgentAvatar = ({ size = "h-12 w-12", textSize = "text-lg" }: { size?: string; textSize?: string }) => {
  const avatar = getAvatarConfig(getAgentAvatarId());
  return (
    <div
      className={`${size} shrink-0 rounded-full flex items-center justify-center ${textSize} font-bold`}
      style={{ background: avatar.bg }}
    >
      {avatar.display}
    </div>
  );
};

// Pre-onboarding config
const preStatCards = [
  { label: "Agent Status", value: "● Setup Required", valueClass: "text-primary" },
  { label: "Pending Approvals", value: "0", valueClass: "text-foreground" },
  { label: "Monthly Cost", value: "$0.00", valueClass: "text-foreground" },
];

const preQuickActions = [
  { icon: FileText, title: "Create Content", sub: "Draft your first post", to: "/dashboard/content" },
  { icon: Search, title: "Add Competitors", sub: "Set up monitoring", to: "/dashboard/competitors" },
  { icon: MessageSquare, title: "Connect Slack", sub: "Bring Luna to Slack", to: "/dashboard/connections" },
];

const Home = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const isOnboarded = localStorage.getItem("pixelport_onboarded") === "true";
  const agentName = getAgentName();
  const companyUrl = localStorage.getItem("pixelport_company_url") || "";

  const [tenantStatus, setTenantStatus] = useState<string>(
    localStorage.getItem("pixelport_tenant_status") || "provisioning"
  );
  const agentActive = tenantStatus === "active";

  useEffect(() => {
    if (!isOnboarded) return;

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/tenants/status", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTenantStatus(data.status);
          localStorage.setItem("pixelport_tenant_status", data.status);
        }
      } catch {
        // Silently retry on next interval
      }
    };

    checkStatus();

    const interval = setInterval(() => {
      if (tenantStatus !== "active" && tenantStatus !== "failed") {
        checkStatus();
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOnboarded, session, tenantStatus]);

  const postQuickActions = [
    { icon: MessageSquare, title: `Chat with ${agentName}`, sub: "Ask questions or give directions", to: "/dashboard/chat" },
    { icon: FileText, title: "Content Pipeline", sub: "View drafts and approve content", to: "/dashboard/content" },
    { icon: Search, title: "Competitor Intel", sub: "See what competitors are doing", to: "/dashboard/competitors" },
  ];

  const activityItems = [
    { emoji: "🔍", text: `Scanning ${companyUrl || "your website"}...`, time: "Just now", active: true },
    { emoji: "📊", text: "Analyzing competitor landscape", time: "Just now", active: true },
    { emoji: "✍️", text: "Preparing first content brief", time: "Starting soon", active: false },
    { emoji: "📧", text: "KPI proposal arriving in ~30 min", time: "Scheduled", active: false },
  ];

  const statCards = isOnboarded
    ? [
        {
          label: "Agent Status",
          value: tenantStatus === "active"
            ? "Active"
            : tenantStatus === "failed"
            ? "Setup Failed"
            : "Provisioning...",
          valueClass: tenantStatus === "active"
            ? "text-green-400"
            : tenantStatus === "failed"
            ? "text-red-400"
            : "text-primary",
          pulse: tenantStatus === "provisioning",
        },
        { label: "Pending Approvals", value: "0", valueClass: "text-foreground" },
        { label: "Monthly Cost", value: "$0.00", valueClass: "text-foreground" },
      ]
    : preStatCards.map((s) => ({ ...s, pulse: false }));

  const quickActions = isOnboarded ? postQuickActions : preQuickActions;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {getGreeting()}, {getFirstName(user)} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening today</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card border-primary/15">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-xl font-semibold mt-2 ${s.valueClass}`}>
                {s.pulse && (
                  <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse mr-1.5 align-middle" />
                )}
                {s.pulse ? "Provisioning..." : s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chief of Staff */}
      <Card className="bg-card border-primary/15 border-l-[3px] border-l-primary">
        <CardContent className="p-6 flex items-start gap-5">
          <AgentAvatar />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{agentName}</h2>
            {isOnboarded ? (
              <>
                <p className="text-muted-foreground text-sm mt-1">
                  {agentName} is getting to know your business. First insights arriving soon.
                </p>
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/chat")}>
                    Chat with {agentName}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/content")}>
                    View Activity
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm mt-1">
                  {agentName} is being set up. Complete onboarding to activate your Chief of Staff.
                </p>
                <Button className="mt-4" size="sm" onClick={() => navigate("/dashboard/settings")}>
                  Complete Onboarding <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((a) => (
            <Card
              key={a.title}
              className="bg-card border-primary/15 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate(a.to)}
            >
              <CardContent className="p-5">
                <a.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-medium text-foreground">{a.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{a.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity (post-onboarding only) */}
      {isOnboarded && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          </div>
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-primary/20" />
            <div className="space-y-4">
              {activityItems.map((item, i) => (
                <div key={i} className={`relative flex items-start gap-4 ${!item.active ? "opacity-60" : ""}`}>
                  {/* Dot */}
                  <div
                    className={`absolute -left-6 top-1.5 w-2 h-2 rounded-full border-2 ${
                      item.active
                        ? "bg-primary border-primary"
                        : "bg-transparent border-muted-foreground/40"
                    }`}
                  />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <p className="text-sm text-foreground">
                      {item.emoji} {item.text}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
