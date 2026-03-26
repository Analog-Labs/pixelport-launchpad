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
  if (!normalized) {
    return "Provisioning";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const StepConnectTools = ({
  companyName,
  agentName,
  goals,
  productsServicesText,
  starterTasks,
  approvalPolicy,
  launching,
  launched,
  status,
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
  const normalizedStatus = status ? toTitleCase(status) : "Provisioning";
  const launchStatusLabel = ready ? "Ready" : normalizedStatus;
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

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Launch your dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {launched
              ? "Provisioning has started. Previous steps are now read-only while checks run."
              : "Review your setup and launch provisioning when ready."}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[hsla(38,60%,58%,0.15)] bg-[hsl(240_14%_8%)] p-5 sm:p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Setup summary</h3>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Company:</span> {companyName || "Your company"}
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Chief:</span> {agentName || "Chief"}
          </p>
          <p className="text-muted-foreground sm:col-span-2">
            <span className="text-foreground font-medium">Goals:</span>{" "}
            {goals.length > 0 ? goals.join(" | ") : "No goals provided yet."}
          </p>
          <p className="text-muted-foreground sm:col-span-2">
            <span className="text-foreground font-medium">Products/Services:</span>{" "}
            {productsServicesText.trim() || "No products/services listed yet."}
          </p>
          <p className="text-muted-foreground sm:col-span-2">
            <span className="text-foreground font-medium">Starter tasks:</span>{" "}
            {starterTasks.length > 0 ? `${starterTasks.length} task rows configured` : "No starter tasks configured."}
          </p>
          <p className="text-muted-foreground sm:col-span-2">
            <span className="text-foreground font-medium">Approval mode:</span> {toTitleCase(approvalPolicy.mode)}
          </p>
        </div>
      </div>

      {launched ? (
        <div className="rounded-xl border border-[hsla(38,60%,58%,0.25)] bg-[hsl(240_14%_8%)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Provisioning status</p>
            <p className={`text-sm font-semibold ${ready ? "text-primary" : "text-muted-foreground"}`}>
              {launchStatusLabel}
            </p>
          </div>

          <div className="space-y-2">
            <div className="h-2.5 rounded-full bg-[hsl(240_10%_20%)] overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{completedChecks}/{totalChecks || 0} checks complete</span>
              <span>{percent}%</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-[hsl(240_14%_6%)] p-3 space-y-1.5">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Current check</p>
            <p className="text-sm text-foreground font-medium">{currentCheck?.label || "Waiting for provisioning signal"}</p>
            <p className="text-xs text-muted-foreground">
              {failedCheck?.detail || currentCheck?.detail || "Provisioning checks are running in sequence."}
            </p>
            {bootstrapStatus && <p className="text-xs text-muted-foreground">Bootstrap status: {toTitleCase(bootstrapStatus)}</p>}
            {lastCheckedAt && <p className="text-xs text-muted-foreground">Last checked: {new Date(lastCheckedAt).toLocaleTimeString()}</p>}
          </div>

          {checks.length > 0 && (
            <div className="space-y-1.5">
              {checks.map((check) => (
                <div key={check.key} className="flex items-start gap-2 text-xs">
                  {check.status === "completed" && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  {check.status === "running" && <PlayCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  {check.status === "failed" && <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                  {check.status === "pending" && <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <span className={check.status === "pending" ? "text-muted-foreground" : "text-foreground"}>{check.label}</span>
                </div>
              ))}
            </div>
          )}

          {(error || failedCheck) && (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 space-y-1.5">
              <p className="text-sm font-medium text-destructive">Provisioning needs attention</p>
              <p className="text-xs text-destructive/90">
                {error || failedCheck?.detail || "A check failed. Retry status first, then retry launch if the tenant returns to draft."}
              </p>
              <p className="text-xs text-muted-foreground">
                Retry guidance: click "Refresh status" to pull the newest check state. If launch dispatch failed previously, relaunch from this step once status is draft.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-primary/30 p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">After launch:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>1. Previous steps become read-only while provisioning runs.</li>
            <li>2. Tenant status moves from draft to provisioning.</li>
            <li>3. The progress bar updates as backend checks complete.</li>
            <li>4. You are redirected to the dashboard once status is ready.</li>
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        {!launched && (
          <Button variant="ghost" onClick={onBack} className="min-h-11 text-muted-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        )}
        {launched ? (
          <Button variant="outline" onClick={onRefresh} disabled={polling} className="flex-1 min-h-11">
            {polling ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            Refresh status
          </Button>
        ) : (
          <Button
            className="flex-1 min-h-11 shimmer-btn text-primary-foreground font-semibold"
            onClick={onLaunch}
            disabled={launching}
          >
            {launching ? "Starting launch..." : "Launch and Start Provisioning"}
          </Button>
        )}
      </div>

      {error && !launched && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default StepConnectTools;
