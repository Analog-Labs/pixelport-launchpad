import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Coffee, Briefcase, Zap, ArrowRight, ArrowLeft } from "lucide-react";

const TONES = [
  { id: "casual", label: "Casual", icon: Coffee, sub: "Friendly, conversational, emoji-friendly 😊" },
  { id: "professional", label: "Professional", icon: Briefcase, sub: "Clear, structured, business-focused" },
  { id: "bold", label: "Bold", icon: Zap, sub: "Direct, opinionated, high-energy 🔥" },
] as const;

const AVATARS = [
  { id: "amber-l", bg: "linear-gradient(135deg, hsl(38 60% 58%), hsl(38 60% 48%))", display: "L" },
  { id: "purple-zap", bg: "linear-gradient(135deg, hsl(270 60% 50%), hsl(290 60% 40%))", display: "⚡" },
  { id: "blue-bot", bg: "linear-gradient(135deg, hsl(210 80% 50%), hsl(220 70% 40%))", display: "🤖" },
  { id: "green-brain", bg: "linear-gradient(135deg, hsl(150 60% 40%), hsl(160 50% 30%))", display: "🧠" },
  { id: "pink-sparkle", bg: "linear-gradient(135deg, hsl(330 70% 55%), hsl(340 60% 45%))", display: "✨" },
  { id: "orange-fire", bg: "linear-gradient(135deg, hsl(25 90% 55%), hsl(15 80% 45%))", display: "🔥" },
];

const SAMPLE_MESSAGES: Record<string, string> = {
  casual: "Hey! 👋 I've been looking at your competitors and have some ideas...",
  professional: "Good morning. I've completed a preliminary competitor analysis and have three recommendations.",
  bold: "Found something big. Your top competitor just launched a new campaign — here's how we counter it. 🎯",
};

interface Props {
  data: { agent_name: string; agent_tone: string; agent_avatar: string };
  onChange: (patch: Partial<Props["data"]>) => void;
  onNext: () => void;
  onBack: () => void;
}

const StepAgentSetup = ({ data, onChange, onNext, onBack }: Props) => {
  const selectedAvatar = AVATARS.find((a) => a.id === data.agent_avatar) || AVATARS[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Meet your Chief of Staff</h2>
          <p className="text-sm text-muted-foreground">Personalize your AI agent</p>
        </div>
      </div>

      {/* Agent Name */}
      <div className="space-y-2">
        <Label htmlFor="agent_name">Name your Chief of Staff</Label>
        <Input
          id="agent_name"
          placeholder="Luna"
          value={data.agent_name}
          onChange={(e) => onChange({ agent_name: e.target.value })}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
          maxLength={50}
        />
        <p className="text-xs text-muted-foreground">This is who you'll chat with every day</p>
      </div>

      {/* Tone */}
      <div className="space-y-3">
        <Label>Communication style</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TONES.map((t) => {
            const selected = data.agent_tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange({ agent_tone: t.id })}
                className={`flex flex-col items-center text-center p-4 rounded-xl border-2 transition-all duration-200 ${
                  selected
                    ? "bg-card border-primary shadow-[0_0_12px_hsla(38,60%,58%,0.1)]"
                    : "bg-[hsl(240_14%_8%)] border-[hsl(240_10%_20%)] hover:border-muted-foreground/40"
                }`}
              >
                <t.icon className={`h-6 w-6 mb-2 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`font-semibold text-sm ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                  {t.label}
                </span>
                <span className="text-xs text-muted-foreground mt-1">{t.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Avatar */}
      <div className="space-y-3">
        <Label>Choose an avatar</Label>
        <div className="flex items-center gap-3 flex-wrap">
          {AVATARS.map((a) => {
            const selected = data.agent_avatar === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onChange({ agent_avatar: a.id })}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-200 ${
                  selected ? "ring-[3px] ring-primary scale-110" : "hover:scale-105"
                }`}
                style={{ background: a.bg }}
              >
                {a.display}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">You can upload a custom avatar later in Settings</p>
      </div>

      {/* Preview */}
      <div className="rounded-xl border-l-[3px] border-l-primary bg-[hsl(240_33%_3%)] border border-[hsla(38,60%,58%,0.15)] p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: selectedAvatar.bg }}
          >
            {selectedAvatar.display}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground">{data.agent_name || "Luna"}</p>
            <p className="text-sm text-muted-foreground mt-1">{SAMPLE_MESSAGES[data.agent_tone]}</p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 shimmer-btn text-primary-foreground font-semibold" onClick={onNext}>
          Next <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepAgentSetup;
