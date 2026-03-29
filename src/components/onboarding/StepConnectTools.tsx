import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Circle, Loader2, RefreshCw, Rocket, AlertTriangle, PlayCircle } from "lucide-react";
import type { ApprovalPolicyInput } from "@/lib/onboarding-presets";

export type ProvisioningProgressCheck = {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  detail?: string | null;
};

export type ProvisioningProgressPayload = {
  total_checks: number;
  completed_checks: number;
  current_check_key: string | null;
  checks: ProvisioningProgressCheck[];
};

interface Props {
  companyName: string;
  agentName: string;
  goals: string[];
  productsServicesText: string;
  starterTasks: string[];
  approvalPolicy: ApprovalPolicyInput;
  launching: boolean;
  launched: boolean;
  status: string | null;
  bootstrapStatus: string | null;
  progress: ProvisioningProgressPayload | null;
  ready: boolean;
  polling: boolean;
  lastCheckedAt: string | null;
  error?: string;
  onBack: () => void;
  onLaunch: () => void;
  onRefresh: () => void;
}

function toTitleCase(value: string): string {
  const normalized = value.replace(/_/g, " ").trim();
  if (!normalized) return "Provisioning";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const StepConnectTools = ({
  agentName,
  launching,
  launched,
  bootstrapStatus,
  progress,
  ready,
  polling,
  lastCheckedAt,
  error,
  onBack,
  onLaunch,
  onRefresh,
}: Props) => {
  const checks = progress?.checks ?? [];
  const totalChecks = progress?.total_checks ?? 0;
  const completedChecks = progress?.completed_checks ?? 0;
  const percent = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : ready ? 100 : 0;

  const currentCheck =
    checks.find((check) => check.key === progress?.current_check_key) ||
    checks.find((check) => check.status === "running") ||
    checks.find((check) => check.status === "pending") ||
    null;

  const failedCheck = checks.find((check) => check.status === "failed") || null;

  /* ── Post-launch: progress-focused view (header rendered by parent) ── */
  if (launched) {
    return (
      <div className="space-y-5">

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{completedChecks}/{totalChecks || 0} checks</span>
            <span className={`font-semibold ${ready ? "text-primary" : "text-foreground"}`}>
              {percent}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[hsl(240_10%_20%)] overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {/* Current check status — inline, no card */}
        {currentCheck && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{currentCheck.label}</p>
            <p className="text-xs text-muted-foreground">
              {failedCheck?.detail || currentCheck.detail || "Running checks in sequence..."}
            </p>
            {bootstrapStatus && (
              <p className="text-xs text-muted-foreground">Bootstrap: {toTitleCase(bootstrapStatus)}</p>
            )}
          </div>
        )}

        {/* Check list */}
        {checks.length > 0 && (
          <div className="border-t border-border/30 pt-4 space-y-2">
            {checks.map((check) => (
              <div key={check.key} className="flex items-center gap-2.5 text-sm">
                {check.status === "completed" && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                {check.status === "running" && <PlayCircle className="h-4 w-4 text-primary shrink-0" />}
                {check.status === "failed" && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                {check.status === "pending" && <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                <span className={check.status === "pending" ? "text-muted-foreground/50" : check.status === "completed" ? "text-muted-foreground" : "text-foreground"}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {(error || failedCheck) && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">Needs attention</p>
            <p className="text-xs text-destructive/80">
              {error || failedCheck?.detail || "A check failed. Try refreshing status."}
            </p>
          </div>
        )}

        {/* Refresh button */}
        <Button variant="outline" onClick={onRefresh} disabled={polling} className="w-full min-h-11">
          {polling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh status
        </Button>

        {lastCheckedAt && (
          <p className="text-xs text-muted-foreground/40 text-center">
            Last checked: {new Date(lastCheckedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    );
  }

  /* ── Pre-launch: guidance + activate button (header/summary rendered by parent) ── */
  return (
    <div className="space-y-5">
      {/* What happens next */}
      <p className="text-sm text-muted-foreground/60 text-center leading-relaxed">
        Provisioning takes a few minutes. You'll be redirected to the dashboard once your agent is live.
      </p>

      {/* Activate button */}
      <Button
        className="w-full min-h-11 shimmer-btn text-primary-foreground font-semibold"
        onClick={onLaunch}
        disabled={launching}
      >
        {launching ? "Activating..." : `Activate ${agentName || "Chief"}`}
        {!launching && <Rocket className="ml-2 h-4 w-4" />}
      </Button>

      {/* Back — subtle, centered */}
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-sm text-muted-foreground/40 hover:text-muted-foreground">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Button>
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  );
};

export default StepConnectTools;
