import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket } from "lucide-react";

interface Props {
  agentName: string;
  error?: string;
  onBack: () => void;
  onLaunch: () => void;
}

const StepConnectTools = ({ agentName, error, onBack, onLaunch }: Props) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Launch your Chief of Staff</h2>
          <p className="text-sm text-muted-foreground">We'll provision the workspace first, then unlock integrations</p>
        </div>
      </div>

      <div className="rounded-xl border border-[hsla(38,60%,58%,0.15)] bg-[hsl(240_14%_8%)] p-6">
        <h3 className="text-lg font-semibold text-foreground">What happens when you launch</h3>
        <p className="text-sm text-muted-foreground mt-3">
          We create the infrastructure for {agentName || "your Chief of Staff"}, deploy the workspace, and start the first research pass.
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          Slack, email, and other integrations become available after provisioning finishes. They are not part of this launch step.
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Tool connections appear later in Dashboard -> Connections once the tenant is active.
      </p>

      {/* What happens next */}
      <div className="rounded-xl border-2 border-dashed border-primary/30 p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">After you complete setup:</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✅ Your Chief of Staff starts scanning your website</li>
          <li>✅ First competitor analysis begins automatically</li>
          <li>✅ Your first content draft arrives within ~30 minutes</li>
          <li>✅ A proposed KPI plan lands in your inbox</li>
        </ul>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 shimmer-btn text-primary-foreground font-semibold text-base py-5" onClick={onLaunch}>
          🚀 Launch My Agent
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};

export default StepConnectTools;
