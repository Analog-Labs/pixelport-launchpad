import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Search, MessageSquare, ArrowRight,
  CheckCircle, Circle, Users, LayoutDashboard, Plug, Zap,
} from "lucide-react";
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

const Home = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const isOnboarded = localStorage.getItem("pixelport_onboarded") === "true";
  const agentName = getAgentName();
  const companyUrl = localStorage.getItem("pixelport_company_url") || "";

  const [tenantStatus, setTenantStatus] = useState<string>(
    localStorage.getItem("pixelport_tenant_status") || "provisioning"
  );
  const [slackConnected, setSlackConnected] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const agentActive = tenantStatus === "active";

  // Status polling (existing)
  useEffect(() => {
    if (!isOnboarded) return;
    let cancelled = false;

    const checkStatus = async () => {
      try {
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/tenants/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTenantStatus(data.status);
          localStorage.setItem("pixelport_tenant_status", data.status);
        }
      } catch { /* retry next interval */ }
    };

    checkStatus();
    const interval = setInterval(() => {
      if (tenantStatus !== "active" && tenantStatus !== "failed") checkStatus();
    }, 10000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [isOnboarded, session, tenantStatus]);

  // Fetch Slack connection status
  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const res = await fetch("/api/connections", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSlackConnected(data.integrations?.slack?.connected === true);
        }
      } catch { /* fail gracefully */ }
    })();
  }, [session]);

  // Fetch tasks
  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const res = await fetch("/api/tasks?limit=10&sort=updated_at&order=desc", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks || []);
        }
      } catch { /* fail gracefully */ }
      setTasksLoading(false);
    })();
  }, [session]);

  // Onboarding checklist logic
  const checklistItems = [
    { label: "Account created", done: true },
    { label: "Agent configured", done: isOnboarded },
    { label: "Slack connected", done: slackConnected, action: !slackConnected ? () => navigate("/dashboard/connections") : undefined, actionLabel: "Connect →" },
    { label: "First content approved", done: false, action: () => navigate("/dashboard/content"), actionLabel: "View content →" },
  ];
  const completedSteps = checklistItems.filter((i) => i.done).length;
  const showChecklist = isOnboarded && completedSteps < 4;

  // Stat cards
  const statCards = [
    {
      label: "Agent Status",
      value: tenantStatus === "active" ? "Active" : tenantStatus === "failed" ? "Failed" : "Provisioning",
      dot: tenantStatus === "active" ? "bg-emerald-500" : tenantStatus === "failed" ? "bg-red-500" : "bg-amber-500",
      pulse: tenantStatus === "provisioning",
    },
    { label: "Pending Approvals", value: "0" },
    { label: "Running Tasks", value: String(tasks.filter((t) => t.status === "running").length) },
    { label: "Monthly Cost", value: "$0.00" },
  ];

  // Work feed: use API tasks or fallback
  const activityItems = tasks.length > 0
    ? tasks.slice(0, 8).map((t) => ({
        text: t.task_description,
        time: new Date(t.updated_at || t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        active: t.status === "running" || t.status === "pending",
      }))
    : isOnboarded
    ? [
        { text: `Scanning ${companyUrl || "your website"}...`, time: "Just now", active: true },
        { text: "Analyzing competitor landscape", time: "Just now", active: true },
        { text: "Preparing first content brief", time: "Starting soon", active: false },
        { text: "KPI proposal arriving in ~30 min", time: "Scheduled", active: false },
      ]
    : [];

  // Team roster: running tasks
  const runningTasks = tasks.filter((t) => t.status === "running").slice(0, 5);

  // Quick actions
  const quickActions = isOnboarded
    ? [
        { icon: MessageSquare, title: `Chat with ${agentName}`, sub: "Ask questions or give directions", to: "/dashboard/chat" },
        { icon: FileText, title: "Content Pipeline", sub: "View drafts and approve content", to: "/dashboard/content" },
        { icon: Search, title: "Competitor Intel", sub: "See what competitors are doing", to: "/dashboard/competitors" },
      ]
    : [
        { icon: FileText, title: "Create Content", sub: "Draft your first post", to: "/dashboard/content" },
        { icon: Search, title: "Add Competitors", sub: "Set up monitoring", to: "/dashboard/competitors" },
        { icon: MessageSquare, title: "Connect Slack", sub: `Bring ${agentName} to Slack`, to: "/dashboard/connections" },
      ];

  // Status badge helper
  const statusBadge = () => {
    if (tenantStatus === "active") return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full">Active</span>;
    if (tenantStatus === "failed") return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/15 px-2.5 py-1 rounded-full">Failed</span>;
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Provisioning</span>;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* 1. Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {getGreeting()}, {getFirstName(user)} 👋
        </h1>
        <p className="text-sm text-zinc-400 mt-1">Here's what's happening today</p>
      </div>

      {/* 2. Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="border border-zinc-800 bg-zinc-900 rounded-lg p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-2 text-foreground flex items-center gap-2">
              {"dot" in s && (
                <span className={`w-2 h-2 rounded-full ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
              )}
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* 3. Onboarding checklist */}
      {showChecklist && (
        <div className="border border-zinc-800 bg-zinc-900 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Get started with {agentName}</h2>
            <span className="text-xs text-zinc-500">{completedSteps}/4 setup steps</span>
          </div>
          <Progress value={(completedSteps / 4) * 100} className="h-1.5 bg-zinc-800" />
          <div className="space-y-3 pt-1">
            {checklistItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {item.done
                    ? <CheckCircle className="h-5 w-5 text-emerald-400" />
                    : <Circle className="h-5 w-5 text-zinc-600" />
                  }
                  <span className={`text-sm ${item.done ? "text-zinc-400 line-through" : "text-foreground"}`}>
                    {item.label}
                  </span>
                </div>
                {!item.done && item.action && (
                  <button onClick={item.action} className="text-xs text-primary hover:text-primary/80 font-medium">
                    {item.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Chief of Staff card */}
      <Card className="bg-card border-border border-l-[3px] border-l-primary">
        <CardContent className="p-6 flex items-start gap-5">
          <AgentAvatar />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">{agentName}</h2>
              {statusBadge()}
            </div>
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

      {/* 5. Two-column: Work Feed + Team Roster */}
      {isOnboarded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Work Feed */}
          <div className="lg:col-span-2 border border-zinc-800 bg-zinc-900 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            {activityItems.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-zinc-800" />
                <div className="space-y-4">
                  {activityItems.map((item, i) => (
                    <div key={i} className={`relative flex items-start gap-4 ${!item.active ? "opacity-60" : ""}`}>
                      <div className={`absolute -left-6 top-1.5 w-2 h-2 rounded-full border-2 ${
                        item.active ? "bg-emerald-500 border-emerald-500" : "bg-transparent border-zinc-600"
                      }`} />
                      <div className="flex-1 flex items-center justify-between gap-2">
                        <p className="text-sm text-foreground">{item.text}</p>
                        <span className="text-xs text-zinc-500 whitespace-nowrap">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{agentName} is getting started... First activity will appear here shortly.</p>
            )}
          </div>

          {/* Team Roster */}
          <div className="border border-zinc-800 bg-zinc-900 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users className="h-4 w-4 text-zinc-500" />
              <h2 className="text-lg font-semibold text-foreground">Active Team</h2>
            </div>
            {runningTasks.length > 0 ? (
              <div className="space-y-3">
                {runningTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="h-4 w-4 text-zinc-400" />
                      <span className="text-sm text-foreground capitalize">{t.agent_role || t.task_type}</span>
                    </div>
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Running</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{agentName} hasn't spawned any specialists yet</p>
            )}
          </div>
        </div>
      )}

      {/* 6. Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((a) => (
            <div
              key={a.title}
              className="border border-zinc-800 bg-zinc-900 rounded-lg p-5 hover:border-zinc-700 transition-colors cursor-pointer"
              onClick={() => navigate(a.to)}
            >
              <a.icon className="h-8 w-8 text-zinc-400 mb-3" />
              <h3 className="font-medium text-foreground">{a.title}</h3>
              <p className="text-sm text-zinc-500 mt-1">{a.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
