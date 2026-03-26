import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Lightbulb, Loader2, RefreshCw, Plus, X } from "lucide-react";
import { GOAL_PRESET_OPTIONS, MAX_ONBOARDING_GOALS } from "@/lib/onboarding-presets";

interface Props {
  goals: string[];
  productsServicesText: string;
  scanState: "idle" | "scanning" | "done" | "failed";
  scanError?: string;
  scanSuggestions: string[];
  goalError?: string;
  onToggleGoal: (goal: string) => void;
  onAddCustomGoal: (goal: string) => void;
  onRemoveGoal: (goal: string) => void;
  onProductsServicesChange: (value: string) => void;
  onApplyScanSuggestions: () => void;
  onRetryScan: () => void;
  onBack: () => void;
  onNext: () => void;
}

const StepStrategy = ({
  goals,
  productsServicesText,
  scanState,
  scanError,
  scanSuggestions,
  goalError,
  onToggleGoal,
  onAddCustomGoal,
  onRemoveGoal,
  onProductsServicesChange,
  onApplyScanSuggestions,
  onRetryScan,
  onBack,
  onNext,
}: Props) => {
  const [customGoal, setCustomGoal] = useState("");
  const canContinue = goals.length > 0 && goals.length <= MAX_ONBOARDING_GOALS;
  const selectedGoalSet = useMemo(() => new Set(goals), [goals]);

  const handleAddCustomGoal = () => {
    const trimmed = customGoal.trim();
    if (!trimmed) {
      return;
    }

    onAddCustomGoal(trimmed);
    setCustomGoal("");
  };

  const showWarmGuidance =
    productsServicesText.trim().length === 0 && scanState !== "scanning" && scanSuggestions.length === 0;

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Strategy setup</h2>
          <p className="text-sm text-muted-foreground">Pick up to three goals and shape what your Chief should prioritize first.</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-[hsl(240_14%_8%)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-semibold text-foreground">Top goals (next 30-90 days)</Label>
          <span className="text-xs text-muted-foreground">
            {goals.length}/{MAX_ONBOARDING_GOALS} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {GOAL_PRESET_OPTIONS.map((presetGoal) => {
            const selected = selectedGoalSet.has(presetGoal);
            const blockedAtLimit = !selected && goals.length >= MAX_ONBOARDING_GOALS;
            return (
              <button
                key={presetGoal}
                type="button"
                onClick={() => onToggleGoal(presetGoal)}
                aria-disabled={blockedAtLimit}
                className={`min-h-11 rounded-full border px-3 py-2 text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary bg-primary/12 text-foreground"
                    : blockedAtLimit
                    ? "border-border bg-[hsl(240_14%_6%)] text-muted-foreground opacity-45"
                    : "border-border bg-[hsl(240_14%_6%)] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {presetGoal}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-[hsl(240_14%_6%)] p-3">
          <Label htmlFor="custom-goal" className="text-xs text-muted-foreground">
            Add a custom goal
          </Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="custom-goal"
              value={customGoal}
              onChange={(event) => setCustomGoal(event.target.value)}
              placeholder="e.g. increase partner-sourced demos"
              className="h-11 bg-[hsl(240_14%_5%)] border-border focus-visible:ring-primary"
              maxLength={160}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={handleAddCustomGoal}
              disabled={customGoal.trim().length < 3}
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        {goals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Selected goals</p>
            <div className="space-y-2">
              {goals.map((goal) => (
                <div
                  key={goal}
                  className="flex min-h-11 items-center justify-between rounded-xl border border-primary/25 bg-primary/8 px-3"
                >
                  <p className="text-sm text-foreground pr-3">{goal}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => onRemoveGoal(goal)}
                    aria-label={`Remove goal ${goal}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {goalError && <p className="text-xs text-destructive">{goalError}</p>}
      </section>

      <section className="rounded-xl border border-border bg-[hsl(240_14%_8%)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label htmlFor="products_services" className="text-sm font-semibold text-foreground">
            Products and services
          </Label>
          <div className="text-xs text-muted-foreground">
            {scanState === "scanning" && (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scanning website...
              </span>
            )}
            {scanState === "done" && scanSuggestions.length > 0 && "Suggestions found"}
            {scanState === "done" && scanSuggestions.length === 0 && "Scan complete"}
            {scanState === "failed" && "Scan failed"}
            {scanState === "idle" && "Manual input available"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-[hsl(240_14%_6%)] p-3 space-y-2">
          {scanState === "scanning" && (
            <p className="text-xs text-muted-foreground">We are extracting offer context from your website. You can keep editing manually while this runs.</p>
          )}

          {scanState === "failed" && (
            <div className="space-y-2">
              <p className="text-xs text-destructive">{scanError || "Scan failed. You can retry without losing edits."}</p>
              <Button type="button" variant="outline" size="sm" onClick={onRetryScan} className="min-h-11">
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry scan
              </Button>
            </div>
          )}

          {scanState !== "failed" && scanSuggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Detected suggestions</p>
              <div className="flex flex-wrap gap-2">
                {scanSuggestions.slice(0, 8).map((suggestion) => (
                  <span
                    key={suggestion}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-foreground"
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onApplyScanSuggestions}>
                Apply suggestions
              </Button>
            </div>
          )}

          {showWarmGuidance && (
            <p className="text-xs text-muted-foreground">
              We did not find enough product context yet. Add your core offers manually so your Chief can plan accurately from day one.
            </p>
          )}
        </div>

        <Textarea
          id="products_services"
          placeholder={"One per line, for example:\n- AI Chief of Staff subscription\n- Content strategy retainer\n- Demand gen advisory"}
          value={productsServicesText}
          onChange={(event) => onProductsServicesChange(event.target.value)}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary min-h-[132px]"
          maxLength={1200}
        />
      </section>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="min-h-11 text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 min-h-11 shimmer-btn text-primary-foreground font-semibold" onClick={onNext} disabled={!canContinue}>
          Continue to Task <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepStrategy;
