import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Bot, Palette, MessageSquare } from "lucide-react";
import {
  AGENT_AVATAR_OPTIONS,
  AGENT_TONE_OPTIONS,
  type AgentToneId,
} from "@/lib/onboarding-presets";
import { AvatarIllustration } from "./AvatarIllustrations";

interface Props {
  data: {
    company_name: string;
    company_url: string;
    agent_name: string;
    agent_tone: string;
    agent_avatar_id: string;
  };
  onChange: (patch: Partial<Props["data"]>) => void;
  onNext: () => void | Promise<void>;
  submitting: boolean;
  error?: string;
}

const StepCompanyInfo = ({
  data,
  onChange,
  onNext,
  submitting,
  error,
}: Props) => {
  const selectedAvatar =
    AGENT_AVATAR_OPTIONS.find((a) => a.id === data.agent_avatar_id) ?? AGENT_AVATAR_OPTIONS[0];
  const toneId = (data.agent_tone || "strategic") as AgentToneId;
  const valid = data.company_name.trim().length >= 2;

  return (
    <div className="space-y-6">
      {/* Section 1: Company */}
      <section className="animate-section-in" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Company</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name" className="text-sm text-muted-foreground">
              Company name
            </Label>
            <Input
              id="company_name"
              placeholder="e.g. Acme Corp"
              value={data.company_name}
              onChange={(e) => onChange({ company_name: e.target.value })}
              className="h-11 bg-[hsl(240_14%_5%)] border-border/50 focus-visible:ring-primary text-sm"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_url" className="text-sm text-muted-foreground">
              Website URL
            </Label>
            <Input
              id="company_url"
              placeholder="https://yourcompany.com"
              value={data.company_url}
              onChange={(e) => onChange({ company_url: e.target.value })}
              className="h-11 bg-[hsl(240_14%_5%)] border-border/50 focus-visible:ring-primary text-sm"
              maxLength={255}
            />
          </div>
        </div>
      </section>

      {/* Section 2: Chief Name */}
      <section className="animate-section-in" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Your Chief</h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent_name" className="text-sm text-muted-foreground">
            Name
          </Label>
          <Input
            id="agent_name"
            placeholder="Chief"
            value={data.agent_name}
            onChange={(e) => onChange({ agent_name: e.target.value })}
            className="h-11 bg-[hsl(240_14%_5%)] border-border/50 focus-visible:ring-primary text-sm"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground/50">Defaults to &ldquo;Chief&rdquo; if left blank.</p>
        </div>
      </section>

      {/* Section 3: Avatar Selection */}
      <section className="animate-section-in" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Avatar</h3>
        </div>
        <div className="flex gap-2.5 overflow-x-auto p-1" role="radiogroup" aria-label="Choose avatar">
          {AGENT_AVATAR_OPTIONS.map((avatar) => {
            const isSelected = avatar.id === selectedAvatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Select ${avatar.label} avatar`}
                onClick={() => onChange({ agent_avatar_id: avatar.id })}
                className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? "border-2 bg-[hsl(240_8%_12%)] scale-110"
                    : "border border-border/40 bg-[hsl(240_8%_6%)] hover:border-border/70 hover:bg-[hsl(240_8%_9%)] hover:scale-[1.03]"
                }`}
                style={
                  isSelected
                    ? {
                        borderColor: avatar.strokeColor,
                        boxShadow: `0 0 12px ${avatar.glowColor}`,
                      }
                    : undefined
                }
              >
                <AvatarIllustration id={avatar.svgId} size={36} glowing={isSelected} />
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 4: Tone Selection */}
      <section className="animate-section-in" style={{ animationDelay: "240ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Tone</h3>
        </div>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Choose communication tone">
          {AGENT_TONE_OPTIONS.map((tone) => {
            const isSelected = tone.id === toneId;
            return (
              <button
                key={tone.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onChange({ agent_tone: tone.id })}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-[0_0_8px_hsla(38,60%,58%,0.3)]"
                    : "bg-[hsl(240_8%_12%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(240_8%_16%)]"
                }`}
              >
                {tone.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <div className="animate-section-in pt-2" style={{ animationDelay: "320ms" }}>
        <Button
          className="w-full min-h-11 shimmer-btn text-primary-foreground font-semibold"
          disabled={!valid || submitting}
          onClick={onNext}
        >
          {submitting ? "Saving company details..." : "Continue to Strategy"}
          {!submitting && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
      </div>
    </div>
  );
};

export default StepCompanyInfo;
