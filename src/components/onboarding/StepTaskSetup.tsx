import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, CheckSquare, Plus, Trash2, ShieldCheck } from "lucide-react";
import {
  APPROVAL_MODE_OPTIONS,
  type ApprovalModeId,
  type ApprovalPolicyInput,
} from "@/lib/onboarding-presets";

interface Props {
  companyName: string;
  goals: string[];
  starterTasks: string[];
  presetTaskCount: number;
  approvalPolicy: ApprovalPolicyInput;
  onTaskChange: (index: number, value: string) => void;
  onAddCustomTask: () => void;
  onRemoveCustomTask: (index: number) => void;
  onApprovalModeChange: (mode: ApprovalModeId) => void;
  onGuardrailChange: (key: keyof ApprovalPolicyInput["guardrails"], value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

const GUARDRAIL_LABELS: Array<{
  key: keyof ApprovalPolicyInput["guardrails"];
  label: string;
  description: string;
}> = [
  {
    key: "publish",
    label: "Publishing content",
    description: "Require approval before publishing externally visible content.",
  },
  {
    key: "paid_spend",
    label: "Paid spend changes",
    description: "Require approval before launching or changing paid campaigns.",
  },
  {
    key: "outbound_messages",
    label: "Outbound messages",
    description: "Require approval before sending outbound email or DM sequences.",
  },
  {
    key: "major_strategy_changes",
    label: "Major strategy changes",
    description: "Require approval before changing core goals or channel strategy.",
  },
];

const StepTaskSetup = ({
  companyName,
  goals,
  starterTasks,
  presetTaskCount,
  approvalPolicy,
  onTaskChange,
  onAddCustomTask,
  onRemoveCustomTask,
  onApprovalModeChange,
  onGuardrailChange,
  onBack,
  onNext,
}: Props) => {
  const hasTasks = starterTasks.length > 0;
  const tasksValid = hasTasks && starterTasks.every((task) => task.trim().length >= 6);
  const guardrailsComplete = GUARDRAIL_LABELS.every(({ key }) => typeof approvalPolicy.guardrails[key] === "boolean");
  const canContinue = tasksValid && !!approvalPolicy.mode && guardrailsComplete;

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <CheckSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Task setup</h2>
          <p className="text-sm text-muted-foreground">
            We seeded goal-mapped tasks for {companyName || "your company"}. You can edit any line and add custom tasks.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-[hsl(240_14%_8%)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold text-foreground">Starter tasks</Label>
          <Button type="button" variant="outline" size="sm" onClick={onAddCustomTask} className="min-h-11">
            <Plus className="mr-1 h-4 w-4" /> Add custom task
          </Button>
        </div>

        {goals.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Goal-mapped rows are listed first. Custom rows can be added or removed anytime.
          </p>
        )}

        <div className="space-y-3">
          {starterTasks.map((task, index) => {
            const isPresetRow = index < presetTaskCount;
            return (
              <div
                key={`starter-task-${index}`}
                className="rounded-xl border border-border bg-[hsl(240_14%_6%)] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    {isPresetRow ? "Goal task" : "Custom task"} {index + 1}
                  </p>
                  {!isPresetRow && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveCustomTask(index)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={task}
                  onChange={(event) => onTaskChange(index, event.target.value)}
                  className="h-11 bg-[hsl(240_14%_5%)] border-border focus-visible:ring-primary"
                  maxLength={320}
                  aria-label={`Starter task ${index + 1}`}
                />
              </div>
            );
          })}
        </div>

        {!tasksValid && (
          <p className="text-xs text-destructive">Each task row must be at least 6 characters.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-[hsl(240_14%_8%)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Approval policy (required)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {APPROVAL_MODE_OPTIONS.map((mode) => {
            const selected = approvalPolicy.mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onApprovalModeChange(mode.id)}
                className={`min-h-11 rounded-xl border px-3 py-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsla(38,60%,58%,0.45)]"
                    : "border-border bg-[hsl(240_14%_6%)] hover:border-primary/45"
                }`}
                aria-pressed={selected}
              >
                <p className="text-sm font-semibold text-foreground">{mode.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{mode.description}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {GUARDRAIL_LABELS.map((guardrail) => (
            <label
              key={guardrail.key}
              className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-[hsl(240_14%_6%)] px-3 py-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={approvalPolicy.guardrails[guardrail.key]}
                onChange={(event) => onGuardrailChange(guardrail.key, event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(38_60%_58%)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{guardrail.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{guardrail.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="min-h-11 text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 min-h-11 shimmer-btn text-primary-foreground font-semibold" onClick={onNext} disabled={!canContinue}>
          Continue to Launch <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepTaskSetup;
