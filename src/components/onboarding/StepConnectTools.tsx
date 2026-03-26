import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw, Rocket } from "lucide-react";

interface Props {
  companyName: string;
  agentName: string;
  missionGoals: string;
  productsServicesText: string;
  starterTask: string;
  suggestionCount: number;
  launching: boolean;
  launched: boolean;
  status: string | null;
  bootstrapStatus: string | null;
  ready: boolean;
  polling: boolean;
  lastCheckedAt: string | null;
  error?: string;
  onBack: () => void;
  onLaunch: () => void;
  onRefresh: () => void;
}

const StepConnectTools = ({
  companyName,
  agentName,
  missionGoals,
  productsServicesText,
  starterTask,
  suggestionCount,
  launching,
  launched,
  status,
  bootstrapStatus,
  ready,
  polling,
  lastCheckedAt,
  error,
  onBack,
  onLaunch,
  onRefresh,
}: Props) => {
  const normalizedStatus = status ? status.replace(/_/g, " ") : "provisioning";
  const launchStatusLabel = ready
    ? "Ready"
    : normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Launch your dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {launched
              ? "Provisioning has started. We locked previous steps as read-only while setup runs."
              : "Review your setup and launch provisioning when ready."}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[hsla(38,60%,58%,0.15)] bg-[hsl(240_14%_8%)] p-6">
        <h3 className="text-lg font-semibold text-foreground">Setup summary</h3>
        <div className="space-y-3 text-sm mt-3">
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Company:</span> {companyName || "Your company"}
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Chief:</span> {agentName || "Luna"}
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Goals:</span>{" "}
            {missionGoals.trim() || "No goals provided yet."}
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Products/Services:</span>{" "}
            {productsServicesText.trim() || "No products/services listed yet."}
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Starter task:</span>{" "}
            {starterTask || "Create the first 14-day marketing execution plan."}
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Editable agent suggestions:</span> {suggestionCount}
          </p>
        </div>
      </div>

      {launched ? (
        <div className="rounded-xl border border-[hsla(38,60%,58%,0.25)] bg-[hsl(240_14%_8%)] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Provisioning status</p>
            <p className={`text-sm font-semibold ${ready ? "text-primary" : "text-muted-foreground"}`}>
              {launchStatusLabel}
            </p>
          </div>
          <div className="h-2 rounded-full bg-[hsl(240_10%_20%)] overflow-hidden">
            <div className={`h-full transition-all duration-500 ${ready ? "w-full bg-primary" : "w-2/3 bg-primary/70"}`} />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Launch request accepted.</p>
            <p>Workspace provisioning and readiness checks are running.</p>
            {bootstrapStatus && <p>Bootstrap status: {bootstrapStatus.replace(/_/g, " ")}</p>}
            {lastCheckedAt && <p>Last checked: {new Date(lastCheckedAt).toLocaleTimeString()}</p>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-primary/30 p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">After launch:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>1. We lock this flow as read-only while provisioning runs.</li>
            <li>2. Your tenant moves from draft to provisioning.</li>
            <li>3. You are redirected to your dashboard when setup finishes.</li>
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        {!launched && (
          <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        )}
        {launched ? (
          <Button variant="outline" onClick={onRefresh} disabled={polling} className="flex-1">
            {polling ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            Refresh status
          </Button>
        ) : (
          <Button
            className="flex-1 shimmer-btn text-primary-foreground font-semibold text-base py-5"
            onClick={onLaunch}
            disabled={launching}
          >
            {launching ? "Starting launch..." : "Launch and Start Provisioning"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default StepConnectTools;
