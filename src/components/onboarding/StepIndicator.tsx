import { Check } from "lucide-react";

const steps = ["Company Info", "Your Agent", "Launch"];

interface StepIndicatorProps {
  currentStep: number; // 1-based
}

const StepIndicator = ({ currentStep }: StepIndicatorProps) => (
  <div className="flex items-center justify-center mb-8">
    {steps.map((label, i) => {
      const stepNum = i + 1;
      const isCompleted = stepNum < currentStep;
      const isCurrent = stepNum === currentStep;
      const isFuture = stepNum > currentStep;

      return (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            {/* Circle */}
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
            {/* Label */}
            <span
              className={`text-xs mt-2 whitespace-nowrap transition-colors duration-300 ${
                isFuture ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {label}
            </span>
          </div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              className={`w-16 sm:w-24 h-0.5 mx-2 mb-6 transition-colors duration-300 ${
                stepNum < currentStep ? "bg-primary" : "bg-[hsl(240_10%_20%)]"
              }`}
            />
          )}
        </div>
      );
    })}
  </div>
);

export default StepIndicator;
