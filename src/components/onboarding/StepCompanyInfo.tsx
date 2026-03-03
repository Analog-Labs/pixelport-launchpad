import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";

const GOALS = [
  { emoji: "📱", label: "Social media growth" },
  { emoji: "✍️", label: "Blog & content creation" },
  { emoji: "🔍", label: "Competitor monitoring" },
  { emoji: "📧", label: "Email marketing" },
  { emoji: "🔎", label: "SEO content" },
  { emoji: "🎯", label: "Lead generation" },
  { emoji: "📊", label: "Brand awareness" },
  { emoji: "➕", label: "Other" },
];

interface Props {
  data: { company_name: string; company_url: string; goals: string[]; other_goal: string };
  onChange: (patch: Partial<Props["data"]>) => void;
  onNext: () => void;
}

const StepCompanyInfo = ({ data, onChange, onNext }: Props) => {
  const toggleGoal = (label: string) => {
    const next = data.goals.includes(label)
      ? data.goals.filter((g) => g !== label)
      : [...data.goals, label];
    onChange({ goals: next });
  };

  const valid = data.company_name.trim().length >= 2 && data.goals.length >= 1;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && valid) onNext();
  };

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Tell us about your company</h2>
          <p className="text-sm text-muted-foreground">We'll use this to personalize your experience</p>
        </div>
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="company_name">Company name</Label>
        <Input
          id="company_name"
          placeholder="e.g. Acme Corp"
          value={data.company_name}
          onChange={(e) => onChange({ company_name: e.target.value })}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
          maxLength={100}
        />
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="company_url">Website URL</Label>
        <Input
          id="company_url"
          placeholder="https://yourcompany.com"
          value={data.company_url}
          onChange={(e) => onChange({ company_url: e.target.value })}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
          maxLength={255}
        />
        <p className="text-xs text-muted-foreground">We'll scan your site to auto-fill brand details</p>
        {data.company_url.trim().length > 5 && (
          <span className="inline-block text-xs bg-primary/20 text-primary px-2.5 py-1 rounded-full">
            ✨ Your agent will analyze this during setup
          </span>
        )}
      </div>

      {/* Goals */}
      <div className="space-y-3">
        <Label>What should your Chief of Staff focus on?</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GOALS.map((g) => {
            const selected = data.goals.includes(g.label);
            return (
              <button
                key={g.label}
                type="button"
                onClick={() => toggleGoal(g.label)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 text-left ${
                  selected
                    ? "bg-primary/20 border-primary text-foreground"
                    : "bg-[hsl(240_14%_8%)] border-[hsl(240_10%_20%)] text-muted-foreground hover:border-muted-foreground/40"
                }`}
              >
                <span>{g.emoji}</span>
                {g.label}
              </button>
            );
          })}
        </div>
        {data.goals.includes("Other") && (
          <Input
            placeholder="Describe your goal..."
            value={data.other_goal}
            onChange={(e) => onChange({ other_goal: e.target.value })}
            className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary mt-2"
            maxLength={200}
          />
        )}
      </div>

      <Button
        className="w-full shimmer-btn text-primary-foreground font-semibold"
        disabled={!valid}
        onClick={onNext}
      >
        Next <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
};

export default StepCompanyInfo;
