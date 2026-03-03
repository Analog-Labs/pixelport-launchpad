import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AgentTeamRoom from "./AgentTeamRoom";
import {
  Clock, Users, ShieldCheck, FileSearch,
  MessageSquare, Linkedin, Twitter, Brain, Sparkles, FileText, Database, BarChart,
} from "lucide-react";

const proofChips = [
  { icon: Clock, text: "24/7 execution" },
  { icon: Users, text: "Multi-agent collaboration" },
  { icon: ShieldCheck, text: "Approval gates" },
  { icon: FileSearch, text: "Full audit trail" },
];

const integrationIcons = [
  { icon: MessageSquare, name: "Slack" },
  { icon: Linkedin, name: "LinkedIn" },
  { icon: Twitter, name: "X" },
  { icon: Brain, name: "OpenAI" },
  { icon: Sparkles, name: "Gemini" },
  { icon: FileText, name: "Notion" },
  { icon: Database, name: "HubSpot" },
  { icon: BarChart, name: "PostHog" },
];

const HeroSection = () => (
  <section className="relative min-h-screen flex flex-col items-center pt-[120px] pb-16 overflow-hidden">
    {/* Ambient glow */}
    <div
      className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full pointer-events-none"
      style={{ background: "radial-gradient(circle, hsla(38, 60%, 58%, 0.08) 0%, transparent 60%)" }}
    />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col items-center">
      {/* Badge */}
      <Badge
        variant="outline"
        className="border-primary/40 text-primary bg-primary/5 px-3 py-1 text-xs font-medium animate-fade-in-up mb-5"
      >
        Built on OpenClaw · 46K+ GitHub ⭐
      </Badge>

      {/* Headline */}
      <h1
        className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1] text-center animate-fade-in-up"
        style={{ animationDelay: "0.1s" }}
      >
        Your AI Chief of Staff
      </h1>

      {/* Subtitle */}
      <p
        className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed text-center mt-5 animate-fade-in-up"
        style={{ animationDelay: "0.2s" }}
      >
        A persistent AI employee that researches competitors, creates platform-native content, manages approvals, and reports performance — all from Slack.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap justify-center gap-3 mt-6 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
        <Button className="shimmer-btn text-primary-foreground px-6 py-3 text-base font-semibold h-auto">
          Start Free 14 Day Trial
        </Button>
        <Button variant="outline" className="px-6 py-3 text-base h-auto border-border hover:border-primary/40">
          Book a Demo
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-3 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
        No credit card required
      </p>

      {/* Agent Team Room */}
      <div className="w-full mt-12 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
        <AgentTeamRoom />
      </div>

      {/* Proof chips */}
      <div className="flex flex-wrap justify-center gap-4 mt-10 animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
        {proofChips.map((chip) => (
          <div key={chip.text} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm text-muted-foreground">
            <chip.icon size={16} className="text-primary" />
            {chip.text}
          </div>
        ))}
      </div>

      {/* Integrations strip */}
      <div className="w-full mt-10 pt-8 border-t border-border animate-fade-in-up" style={{ animationDelay: "0.7s" }}>
        <p className="text-center text-sm text-muted-foreground mb-5">Connects to the tools you already use</p>
        <div className="flex flex-wrap justify-center gap-6">
          {integrationIcons.map((item) => (
            <div key={item.name} className="flex flex-col items-center gap-1.5 group cursor-default">
              <item.icon size={28} className="text-muted-foreground group-hover:text-primary transition-colors duration-300" />
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection;
