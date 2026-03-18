import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket } from "lucide-react";

interface Props {
  companyName: string;
  agentName: string;
  starterTask: string;
  suggestionCount: number;
  launching: boolean;
  error?: string;
  onBack: () => void;
  onLaunch: () => void;
}

const StepConnectTools = ({
  companyName,
  agentName,
  starterTask,
  suggestionCount,
  launching,
  error,
  onBack,
  onLaunch,
}: Props) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Launch your workspace</h2>
          <p className="text-sm text-muted-foreground">Finalize your setup and continue to your Paperclip workspace</p>
        </div>
      </div>

      <div className="rounded-xl border border-[hsla(38,60%,58%,0.15)] bg-[hsl(240_14%_8%)] p-6">
        <h3 className="text-lg font-semibold text-foreground">Setup summary</h3>
        <p className="text-sm text-muted-foreground mt-3">
          {companyName || "Your company"} is ready. {agentName || "Luna"} will start from this task:
        </p>
        <p className="text-sm text-foreground mt-3 rounded-lg border border-border bg-[hsl(240_14%_6%)] p-3">
          {starterTask || "Create the first 14-day marketing execution plan."}
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          Editable agent suggestions configured: {suggestionCount}
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-primary/30 p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">After launch:</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>1. We persist your starter task and agent setup to onboarding data.</li>
          <li>2. You are redirected to your tenant&apos;s Paperclip workspace.</li>
          <li>3. Dashboard tools remain available in PixelPort when needed.</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button
          className="flex-1 shimmer-btn text-primary-foreground font-semibold text-base py-5"
          onClick={onLaunch}
          disabled={launching}
        >
          {launching ? "Finalizing..." : "Launch and Open Workspace"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default StepConnectTools;
