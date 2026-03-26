import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight, Palette, Sparkles } from "lucide-react";
import { AGENT_AVATAR_OPTIONS, AGENT_TONE_OPTIONS } from "@/lib/onboarding-presets";

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

const StepCompanyInfo = ({ data, onChange, onNext, submitting, error }: Props) => {
  const selectedAvatar =
    AGENT_AVATAR_OPTIONS.find((avatar) => avatar.id === data.agent_avatar_id) ?? AGENT_AVATAR_OPTIONS[0];

  const valid = data.company_name.trim().length >= 2;

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Tell us about your company</h2>
          <p className="text-sm text-muted-foreground">We use this to configure your Chief identity and launch context.</p>
        </div>
      </div>

      <section className="rounded-xl border border-[hsla(38,60%,58%,0.24)] bg-[hsl(240_14%_8%)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Chief identity
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-2">
            <Label htmlFor="agent_name">Chief of Staff name</Label>
            <Input
              id="agent_name"
              placeholder="Chief"
              value={data.agent_name}
              onChange={(event) => onChange({ agent_name: event.target.value })}
              className="h-11 bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">If left blank, we will use "Chief".</p>
          </div>

          <div className="space-y-2">
            <Label>Avatar (dashboard only)</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {AGENT_AVATAR_OPTIONS.map((avatar) => {
                const selected = avatar.id === selectedAvatar.id;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => onChange({ agent_avatar_id: avatar.id })}
                    className={`min-h-11 rounded-xl border px-2 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      selected
                        ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsla(38,60%,58%,0.45)]"
                        : "border-border bg-[hsl(240_14%_6%)] hover:border-primary/50"
                    }`}
                    aria-pressed={selected}
                    aria-label={`Choose ${avatar.label} avatar`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ background: avatar.accent }}
                      >
                        {avatar.monogram}
                      </span>
                      <span className="text-xs font-medium text-foreground">{avatar.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-[hsl(240_14%_8%)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="h-4 w-4 text-primary" />
          Company profile
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_name">Company name</Label>
          <Input
            id="company_name"
            placeholder="e.g. Acme Corp"
            value={data.company_name}
            onChange={(event) => onChange({ company_name: event.target.value })}
            className="h-11 bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_url">Website URL</Label>
          <Input
            id="company_url"
            placeholder="https://yourcompany.com"
            value={data.company_url}
            onChange={(event) => onChange({ company_url: event.target.value })}
            className="h-11 bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
            maxLength={255}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-[hsl(240_14%_8%)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Palette className="h-4 w-4 text-primary" />
          Communication tone
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {AGENT_TONE_OPTIONS.map((tone) => {
            const selected = tone.id === data.agent_tone;
            return (
              <button
                key={tone.id}
                type="button"
                onClick={() => onChange({ agent_tone: tone.id })}
                className={`min-h-11 rounded-xl border px-3 py-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsla(38,60%,58%,0.45)]"
                    : "border-border bg-[hsl(240_14%_6%)] hover:border-primary/50"
                }`}
                aria-pressed={selected}
              >
                <p className="text-sm font-semibold text-foreground">{tone.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tone.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <Button
        className="w-full min-h-11 shimmer-btn text-primary-foreground font-semibold"
        disabled={!valid || submitting}
        onClick={onNext}
      >
        {submitting ? "Saving company details..." : "Continue to Strategy"}
        {!submitting && <ArrowRight className="ml-1 h-4 w-4" />}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default StepCompanyInfo;
