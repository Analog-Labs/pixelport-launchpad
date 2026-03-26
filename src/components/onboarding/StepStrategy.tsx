import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Lightbulb, Loader2 } from "lucide-react";

interface Props {
  missionGoals: string;
  productsServicesText: string;
  scanState: "idle" | "scanning" | "done" | "failed";
  scanError?: string;
  onMissionGoalsChange: (value: string) => void;
  onProductsServicesChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const StepStrategy = ({
  missionGoals,
  productsServicesText,
  scanState,
  scanError,
  onMissionGoalsChange,
  onProductsServicesChange,
  onBack,
  onNext,
}: Props) => {
  const canContinue = missionGoals.trim().length >= 3;
  const showEmptyState = productsServicesText.trim().length === 0 && scanState !== "scanning";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Strategy setup</h2>
          <p className="text-sm text-muted-foreground">
            Define the top priorities and products/services your Chief should focus on.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mission_goals">Top goals (next 30-90 days)</Label>
        <Textarea
          id="mission_goals"
          placeholder={"Example:\n- Increase qualified pipeline by 20%\n- Improve LinkedIn consistency\n- Test one new acquisition channel"}
          value={missionGoals}
          onChange={(event) => onMissionGoalsChange(event.target.value)}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary min-h-[120px]"
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="products_services">Products and services</Label>
          {scanState === "scanning" && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Scanning your website...
            </p>
          )}
        </div>
        <Textarea
          id="products_services"
          placeholder={"One per line, for example:\n- AI Chief of Staff subscription\n- Content strategy retainer\n- Demand gen advisory"}
          value={productsServicesText}
          onChange={(event) => onProductsServicesChange(event.target.value)}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary min-h-[120px]"
          maxLength={800}
        />
        {showEmptyState && (
          <div className="rounded-lg border border-[hsla(38,60%,58%,0.3)] bg-[hsla(38,60%,58%,0.08)] p-3">
            <p className="text-sm text-foreground font-medium">We have limited product context so far.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add your core offers manually so your Chief can generate stronger plans from day one.
            </p>
          </div>
        )}
        {scanState === "failed" && scanError && (
          <p className="text-xs text-destructive">{scanError}</p>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 shimmer-btn text-primary-foreground font-semibold" onClick={onNext} disabled={!canContinue}>
          Continue to Task <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepStrategy;
