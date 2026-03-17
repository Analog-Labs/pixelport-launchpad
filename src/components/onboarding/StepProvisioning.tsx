import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, RefreshCw, Server } from "lucide-react";

interface Props {
  companyName: string;
  agentName: string;
  status: string;
  bootstrapStatus: string | null;
  ready: boolean;
  polling: boolean;
  lastCheckedAt: string | null;
  error?: string;
  onRefresh: () => void;
  onNext: () => void;
}

function formatStatus(status: string): string {
  if (!status) {
    return "Provisioning";
  }

  return status
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

const StepProvisioning = ({
  companyName,
  agentName,
  status,
  bootstrapStatus,
  ready,
  polling,
  lastCheckedAt,
  error,
  onRefresh,
  onNext,
}: Props) => {
  const runtimeLabel = ready ? "Ready" : formatStatus(status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Server className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Provisioning your workspace</h2>
          <p className="text-sm text-muted-foreground">
            {companyName || "Your company"} is being prepared for {agentName || "Luna"}.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[hsla(38,60%,58%,0.15)] bg-[hsl(240_14%_8%)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Tenant status</p>
          <p className={`text-sm font-semibold ${ready ? "text-primary" : "text-muted-foreground"}`}>
            {runtimeLabel}
          </p>
        </div>
        <div className="h-2 rounded-full bg-[hsl(240_10%_20%)] overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${ready ? "w-full bg-primary" : "w-2/3 bg-primary/70"}`}
          />
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. Tenant record created.</p>
          <p>2. Droplet + runtime provisioning in progress.</p>
          <p>3. Task setup unlocks once status is ready.</p>
          {bootstrapStatus && <p>Bootstrap status: {formatStatus(bootstrapStatus)}</p>}
          {lastCheckedAt && <p>Last checked: {new Date(lastCheckedAt).toLocaleTimeString()}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onRefresh} disabled={polling}>
          {polling ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Refresh status
        </Button>
        <Button className="flex-1 shimmer-btn text-primary-foreground font-semibold" onClick={onNext} disabled={!ready}>
          Continue to Task <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default StepProvisioning;
