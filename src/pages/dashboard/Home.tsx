import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, FileText, Search, MessageSquare, ArrowRight } from "lucide-react";

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

const statCards = [
  { label: "Agent Status", value: "● Setup Required", valueClass: "text-primary" },
  { label: "Pending Approvals", value: "0", valueClass: "text-foreground" },
  { label: "Monthly Cost", value: "$0.00", valueClass: "text-foreground" },
];

const quickActions = [
  { icon: FileText, title: "Create Content", sub: "Draft your first post", to: "/dashboard/content" },
  { icon: Search, title: "Add Competitors", sub: "Set up monitoring", to: "/dashboard/competitors" },
  { icon: MessageSquare, title: "Connect Slack", sub: "Bring Luna to Slack", to: "/dashboard/connections" },
];

const AVATAR_MAP: Record<string, { bg: string; display: string }> = {
  "amber-l": { bg: "linear-gradient(135deg, hsl(38 60% 58%), hsl(38 60% 48%))", display: "L" },
  "purple-zap": { bg: "linear-gradient(135deg, hsl(270 60% 50%), hsl(290 60% 40%))", display: "⚡" },
  "blue-bot": { bg: "linear-gradient(135deg, hsl(210 80% 50%), hsl(220 70% 40%))", display: "🤖" },
  "green-brain": { bg: "linear-gradient(135deg, hsl(150 60% 40%), hsl(160 50% 30%))", display: "🧠" },
  "pink-sparkle": { bg: "linear-gradient(135deg, hsl(330 70% 55%), hsl(340 60% 45%))", display: "✨" },
  "orange-fire": { bg: "linear-gradient(135deg, hsl(25 90% 55%), hsl(15 80% 45%))", display: "🔥" },
};

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const agentName = localStorage.getItem("pixelport_agent_name") || "Luna";
  const avatarId = localStorage.getItem("pixelport_agent_avatar") || "amber-l";
  const avatar = AVATAR_MAP[avatarId] || AVATAR_MAP["amber-l"];

  const AgentAvatar = () => (
    <div
      className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-lg font-bold"
      style={{ background: avatar.bg }}
    >
      {avatar.display}
    </div>
  );

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
          <Card key={s.label} className="bg-[hsl(240_20%_7%)] border-primary/15">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-xl font-semibold mt-2 ${s.valueClass}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chief of Staff */}
      <Card className="bg-[hsl(240_20%_7%)] border-primary/15 border-l-[3px] border-l-primary">
        <CardContent className="p-6 flex items-start gap-5">
          <AgentAvatar />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{agentName}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {agentName} is being set up. Complete onboarding to activate your Chief of Staff.
            </p>
            <Button className="mt-4" size="sm" onClick={() => navigate("/dashboard/settings")}>
              Complete Onboarding <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((a) => (
            <Card key={a.title} className="bg-[hsl(240_20%_7%)] border-primary/15 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(a.to)}>
              <CardContent className="p-5">
                <a.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-medium text-foreground">{a.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{a.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
