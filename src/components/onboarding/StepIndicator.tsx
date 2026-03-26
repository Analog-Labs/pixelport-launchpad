import { Check } from "lucide-react";

const steps = ["Company", "Strategy", "Task", "Launch"];

interface StepIndicatorProps {
  currentStep: number; // 1-based
}

const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  const safeStep = Math.min(Math.max(currentStep, 1), steps.length);
  const percent = (safeStep / steps.length) * 100;

  return (
    <div className="mb-8">
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground font-medium">
            Step {safeStep} of {steps.length}
          </span>
          <span className="text-muted-foreground">{steps[safeStep - 1]}</span>
        </div>
        <div className="h-2 rounded-full bg-[hsl(240_10%_20%)] overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-center">
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < safeStep;
          const isCurrent = stepNum === safeStep;
          const isFuture = stepNum > safeStep;

          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "border-2 border-[hsl(240_10%_20%)] text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                <span
                  className={`text-xs mt-2 whitespace-nowrap transition-colors duration-300 ${
                    isFuture ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>

              {i < steps.length - 1 && (
                <div
                  className={`w-8 sm:w-14 h-0.5 mx-2 mb-6 transition-colors duration-300 ${
                    stepNum < safeStep ? "bg-primary" : "bg-[hsl(240_10%_20%)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
