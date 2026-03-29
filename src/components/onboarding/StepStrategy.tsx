import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Lightbulb, Loader2, RefreshCw, Plus, X, ChevronDown, ChevronRight, Package, Pencil, Target } from "lucide-react";
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
  const [productsExpanded, setProductsExpanded] = useState(
    productsServicesText.trim().length > 0 || scanSuggestions.length > 0
  );
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showManualProducts, setShowManualProducts] = useState(false);
  const canContinue = goals.length > 0 && goals.length <= MAX_ONBOARDING_GOALS;
  const selectedGoalSet = useMemo(() => new Set(goals), [goals]);
  const customGoals = useMemo(
    () => goals.filter((g) => !GOAL_PRESET_OPTIONS.includes(g as typeof GOAL_PRESET_OPTIONS[number])),
    [goals]
  );

  const handleAddCustomGoal = () => {
    const trimmed = customGoal.trim();
    if (!trimmed) return;
    onAddCustomGoal(trimmed);
    setCustomGoal("");
  };

  const showWarmGuidance =
    productsServicesText.trim().length === 0 && scanState !== "scanning" && scanSuggestions.length === 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Lightbulb className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Strategy setup</h2>
          <p className="text-base text-muted-foreground mt-0.5">
            Pick up to three goals and shape what your Chief should prioritize first.
          </p>
        </div>
      </div>

      {/* ── Goals (borderless — right panel bg is the surface) ── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold text-foreground">
              Top goals <span className="text-muted-foreground font-normal">(next 30–90 days)</span>
            </Label>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {goals.length}/{MAX_ONBOARDING_GOALS}
          </span>
        </div>

        {/* Preset + custom goal chips — all in one row */}
        <div className="flex flex-wrap gap-2.5">
          {GOAL_PRESET_OPTIONS.map((presetGoal) => {
            const selected = selectedGoalSet.has(presetGoal);
            const blockedAtLimit = !selected && goals.length >= MAX_ONBOARDING_GOALS;
            return (
              <button
                key={presetGoal}
                type="button"
                onClick={() => selected ? onRemoveGoal(presetGoal) : onToggleGoal(presetGoal)}
                aria-disabled={blockedAtLimit}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary bg-primary/12 text-foreground shadow-[0_0_8px_hsla(38,60%,58%,0.15)]"
                    : blockedAtLimit
                    ? "border-border bg-[hsl(240_14%_6%)] text-muted-foreground opacity-40 cursor-not-allowed"
                    : "border-border bg-[hsl(240_14%_6%)] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {presetGoal}
                {selected && <X className="h-3.5 w-3.5 text-primary/60 hover:text-primary" />}
              </button>
            );
          })}

          {/* Custom goals as chips in the same row */}
          {customGoals.map((goal) => (
            <button
              key={goal}
              type="button"
              onClick={() => onRemoveGoal(goal)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/12 text-foreground px-4 py-2.5 text-sm font-medium shadow-[0_0_8px_hsla(38,60%,58%,0.15)] transition-all duration-200"
            >
              {goal}
              <X className="h-3.5 w-3.5 text-primary/60 hover:text-primary" />
            </button>
          ))}
        </div>

        {goalError && <p className="text-sm text-destructive">{goalError}</p>}

        {/* Custom goal — toggle to show input */}
        {!showCustomInput ? (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            disabled={goals.length >= MAX_ONBOARDING_GOALS}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" /> Add custom goal
          </button>
        ) : (
          <div className="flex gap-2">
            <Input
              id="custom-goal"
              value={customGoal}
              onChange={(event) => setCustomGoal(event.target.value)}
              placeholder="e.g. increase partner-sourced demos"
              className="h-10 bg-[hsl(240_14%_5%)] border-border focus-visible:ring-primary text-sm"
              maxLength={160}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCustomGoal();
                if (e.key === "Escape") { setShowCustomInput(false); setCustomGoal(""); }
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => { handleAddCustomGoal(); setShowCustomInput(false); }}
              disabled={customGoal.trim().length < 3 || goals.length >= MAX_ONBOARDING_GOALS}
            >
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-2"
              onClick={() => { setShowCustomInput(false); setCustomGoal(""); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>

      {/* ── Products & Services (collapsible) ── */}
      <section className="border-t border-border/30 pt-6">
        <button
          type="button"
          onClick={() => setProductsExpanded(!productsExpanded)}
          className="w-full flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <span className="text-base font-semibold text-foreground">Products & services</span>
              <span className="text-sm text-muted-foreground ml-2">(optional)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {scanState === "scanning" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </span>
            )}
            {scanState === "done" && scanSuggestions.length > 0 && !productsExpanded && (
              <span className="text-sm text-primary">{scanSuggestions.length} suggestions</span>
            )}
            {productsExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </div>
        </button>

        {productsExpanded && (
          <div className="mt-4 space-y-4">
            {/* Scan status — inline text, no card wrapper */}
            {scanState === "scanning" && (
              <p className="text-sm text-muted-foreground">
                Extracting offer context from your website. You can edit manually while this runs.
              </p>
            )}

            {scanState === "failed" && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-destructive flex-1">{scanError || "Scan failed."}</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetryScan}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            )}

            {scanState !== "failed" && scanSuggestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Detected from your website</p>
                <div className="flex flex-wrap gap-2">
                  {scanSuggestions.slice(0, 8).map((suggestion) => (
                    <span
                      key={suggestion}
                      className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-foreground font-medium"
                    >
                      {suggestion}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={onApplyScanSuggestions}>
                    Apply suggestions
                  </Button>
                  {!showManualProducts && (
                    <button
                      type="button"
                      onClick={() => setShowManualProducts(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit manually
                    </button>
                  )}
                </div>
              </div>
            )}

            {showWarmGuidance && (
              <p className="text-sm text-muted-foreground">
                Add your core offers so your Chief can plan accurately from day one.
              </p>
            )}

            {/* Show textarea when: no suggestions available, or user clicked "Edit manually" */}
            {(scanSuggestions.length === 0 || showManualProducts) && (
              <Textarea
                id="products_services"
                placeholder={"One per line, for example:\n- AI Chief of Staff subscription\n- Content strategy retainer\n- Demand gen advisory"}
                value={productsServicesText}
                onChange={(event) => onProductsServicesChange(event.target.value)}
                className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary min-h-[100px] text-sm"
                maxLength={1200}
              />
            )}
          </div>
        )}
      </section>

      {/* ── Navigation ── */}
      <div className="flex gap-3 pt-2">
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
