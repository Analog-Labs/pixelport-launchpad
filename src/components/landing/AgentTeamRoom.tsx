import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Play, Crown, Search, PenTool, Paintbrush, CalendarClock, BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const loopSteps = ["Plan", "Create", "Review", "Publish", "Measure", "Improve"];

interface Agent {
  role: string;
  description: string;
  status: string;
  icon: LucideIcon;
  statusColor: string;
}

const agents: Agent[] = [
  { role: "Research", description: "Finds trends and audience insights", status: "Researching", icon: Search, statusColor: "bg-emerald-500/15 text-emerald-400" },
  { role: "Copywriter", description: "Drafts post copy and captions", status: "Drafting", icon: PenTool, statusColor: "bg-amber-500/15 text-amber-400" },
  { role: "Designer", description: "Creates image concepts and briefs", status: "Designing", icon: Paintbrush, statusColor: "bg-purple-500/15 text-purple-400" },
  { role: "Publisher", description: "Schedules and publishes content", status: "Scheduling", icon: CalendarClock, statusColor: "bg-cyan-500/15 text-cyan-400" },
  { role: "Analyst", description: "Tracks performance and reports", status: "Reporting", icon: BarChart3, statusColor: "bg-orange-500/15 text-orange-400" },
];

interface FeedItem {
  text: string;
  time: string;
  agent: string;
  agentIcon: LucideIcon;
}

const feed: FeedItem[] = [
  { text: "Drafted LinkedIn post: '5 lessons from scaling'", time: "37m ago", agent: "Copywriter", agentIcon: PenTool },
  { text: "Created 3 image variants for carousel", time: "9m ago", agent: "Designer", agentIcon: Paintbrush },
  { text: "Scheduled to LinkedIn @ 9:15 AM EST", time: "12m ago", agent: "Publisher", agentIcon: CalendarClock },
  { text: "Weekly report: +22% engagement", time: "52m ago", agent: "Analyst", agentIcon: BarChart3 },
];

const AgentTeamRoom = () => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const runCycle = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentStep(0);
  }, [isAnimating]);

  useEffect(() => {
    if (!isAnimating || currentStep < 0) return;
    if (currentStep >= loopSteps.length) {
      setIsAnimating(false);
      setCurrentStep(-1);
      return;
    }
    const timer = setTimeout(() => setCurrentStep((p) => p + 1), 1200);
    return () => clearTimeout(timer);
  }, [isAnimating, currentStep]);

  const getAgentStatus = (originalStatus: string) => {
    if (!isAnimating || currentStep < 0 || currentStep >= loopSteps.length) return originalStatus;
    return loopSteps[currentStep] + "...";
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden max-w-4xl mx-auto shadow-lg shadow-primary/5">
      {/* Window chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <span className="font-semibold text-sm text-foreground">Marketing Team</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">Live</span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Agent Roster */}
        <div className="p-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Team Roster
          </h4>

          {/* Chief of Staff */}
          <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-border">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Crown className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Luna · Chief of Staff</p>
              <p className="text-[11px] text-muted-foreground">Orchestrates tasks and assigns work</p>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-emerald-500/15 text-emerald-400 transition-all duration-300">
              {isAnimating ? "Coordinating" : "Executing"}
            </span>
          </div>

          {/* Sub-agents */}
          <div className="space-y-2">
            {agents.map((agent) => (
              <div key={agent.role} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <agent.icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{agent.role}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{agent.description}</p>
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition-all duration-300 ${
                    isAnimating ? "bg-primary/10 text-primary" : agent.statusColor
                  }`}
                >
                  {getAgentStatus(agent.status)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Work Feed */}
        <div className="p-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Live Work Feed
          </h4>
          <div className="space-y-2">
            {feed.map((item, i) => (
              <div key={i} className="bg-surface rounded-lg p-2.5 transition-all duration-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{item.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-secondary px-1.5 py-0.5 rounded-md shrink-0">
                    <item.agentIcon className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[9px] font-medium text-muted-foreground">{item.agent}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow footer */}
      <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {loopSteps.map((step, i) => (
            <span
              key={step}
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-all duration-300 ${
                currentStep === i
                  ? "bg-primary text-primary-foreground scale-110"
                  : currentStep > i
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {step}
            </span>
          ))}
        </div>
        <Button onClick={runCycle} disabled={isAnimating} variant="outline" size="sm" className="gap-1 ml-3 shrink-0 h-7 text-xs px-2.5">
          <Play className="w-3 h-3" />
          {isAnimating ? "Running..." : "Run a cycle"}
        </Button>
      </div>
    </div>
  );
};

export default AgentTeamRoom;
