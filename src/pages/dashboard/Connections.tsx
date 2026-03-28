import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  APPROVAL_MODE_OPTIONS,
  DEFAULT_APPROVAL_POLICY,
  type ApprovalPolicyInput,
} from "@/lib/onboarding-presets";

interface SlackInfo {
  connected: boolean;
  active: boolean;
  status: "not_connected" | "reauthorization_required" | "activating" | "active";
  team_name?: string;
  connected_at?: string;
  missing_scopes?: string[];
  reauthorization_required?: boolean;
}

interface EmailInfo {
  connected: boolean;
  inbox: string | null;
}

interface PolicyApplySummary {
  status: "pending" | "applied" | "failed";
  revision: number;
  last_error: string | null;
  last_applied_revision: number | null;
  last_applied_at: string | null;
  updated_at: string | null;
}

type GovernanceUiState = "loading" | "clean" | "dirty" | "saving" | "applied" | "pending" | "failed" | "conflict";

type GuardrailKey = keyof ApprovalPolicyInput["guardrails"];

const GUARDRAIL_LABELS: Array<{
  key: GuardrailKey;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized >= 1 ? normalized : null;
}

function clonePolicy(policy: ApprovalPolicyInput): ApprovalPolicyInput {
  return {
    mode: policy.mode,
    guardrails: {
      publish: policy.guardrails.publish,
      paid_spend: policy.guardrails.paid_spend,
      outbound_messages: policy.guardrails.outbound_messages,
      major_strategy_changes: policy.guardrails.major_strategy_changes,
    },
  };
}

function parsePolicyApplySummary(value: unknown): PolicyApplySummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = readString(value.status).toLowerCase();
  if (status !== "pending" && status !== "applied" && status !== "failed") {
    return null;
  }

  const revision = readPositiveInt(value.revision) ?? 1;
  return {
    status,
    revision,
    last_error: readString(value.last_error) || null,
    last_applied_revision: readPositiveInt(value.last_applied_revision),
    last_applied_at: readString(value.last_applied_at) || null,
    updated_at: readString(value.updated_at) || null,
  };
}

function parsePolicyFromOnboarding(onboardingData: unknown): ApprovalPolicyInput {
  if (!isRecord(onboardingData)) {
    return clonePolicy(DEFAULT_APPROVAL_POLICY);
  }

  const nestedTask =
    isRecord(onboardingData.v2) && isRecord(onboardingData.v2.task)
      ? onboardingData.v2.task
      : null;

  const candidates = [onboardingData.approval_policy, nestedTask?.approval_policy];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue;
    }

    const mode = readString(candidate.mode).toLowerCase();
    if (mode !== "strict" && mode !== "balanced" && mode !== "autonomous") {
      continue;
    }

    const guardrails = isRecord(candidate.guardrails) ? candidate.guardrails : {};
    return {
      mode,
      guardrails: {
        publish:
          typeof guardrails.publish === "boolean"
            ? guardrails.publish
            : DEFAULT_APPROVAL_POLICY.guardrails.publish,
        paid_spend:
          typeof guardrails.paid_spend === "boolean"
            ? guardrails.paid_spend
            : DEFAULT_APPROVAL_POLICY.guardrails.paid_spend,
        outbound_messages:
          typeof guardrails.outbound_messages === "boolean"
            ? guardrails.outbound_messages
            : DEFAULT_APPROVAL_POLICY.guardrails.outbound_messages,
        major_strategy_changes:
          typeof guardrails.major_strategy_changes === "boolean"
            ? guardrails.major_strategy_changes
            : DEFAULT_APPROVAL_POLICY.guardrails.major_strategy_changes,
      },
    };
  }

  return clonePolicy(DEFAULT_APPROVAL_POLICY);
}

function policiesEqual(left: ApprovalPolicyInput, right: ApprovalPolicyInput): boolean {
  return (
    left.mode === right.mode &&
    left.guardrails.publish === right.guardrails.publish &&
    left.guardrails.paid_spend === right.guardrails.paid_spend &&
    left.guardrails.outbound_messages === right.guardrails.outbound_messages &&
    left.guardrails.major_strategy_changes === right.guardrails.major_strategy_changes
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Not yet";
  }

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return value;
  }

  return asDate.toLocaleString();
}

function getModeLabel(mode: ApprovalPolicyInput["mode"]): string {
  const matched = APPROVAL_MODE_OPTIONS.find((option) => option.id === mode);
  return matched ? matched.label : mode;
}

function getGuardrailSummary(policy: ApprovalPolicyInput): string {
  const required = GUARDRAIL_LABELS.filter(({ key }) => policy.guardrails[key]).map(({ label }) => label);
  if (required.length === 0) {
    return "No guardrails currently require approval.";
  }
  return `${required.length} guardrail${required.length === 1 ? "" : "s"} require approval.`;
}

const Connections = () => {
  const { session, tenant, refreshTenant } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [slack, setSlack] = useState<SlackInfo>({
    connected: false,
    active: false,
    status: "not_connected",
    missing_scopes: [],
    reauthorization_required: false,
  });
  const [email, setEmail] = useState<EmailInfo>({ connected: false, inbox: null });
  const [connecting, setConnecting] = useState(false);
  const [governanceSummary, setGovernanceSummary] = useState<PolicyApplySummary | null>(null);
  const [savedPolicy, setSavedPolicy] = useState<ApprovalPolicyInput>(clonePolicy(DEFAULT_APPROVAL_POLICY));
  const [draftPolicy, setDraftPolicy] = useState<ApprovalPolicyInput>(clonePolicy(DEFAULT_APPROVAL_POLICY));
  const [governanceEditing, setGovernanceEditing] = useState(false);
  const [governanceSaving, setGovernanceSaving] = useState(false);
  const [governanceConflict, setGovernanceConflict] = useState<string | null>(null);
  const [governanceError, setGovernanceError] = useState<string | null>(null);

  const provisioningComplete = tenant?.status === "active";
  const slackReady = slack.status === "active";
  const slackNeedsReconnect = slack.status === "reauthorization_required";
  const policyDirty = !policiesEqual(savedPolicy, draftPolicy);

  useEffect(() => {
    const onboardingPolicy = parsePolicyFromOnboarding(tenant?.onboarding_data);
    setSavedPolicy(onboardingPolicy);
    if (!governanceEditing) {
      setDraftPolicy(onboardingPolicy);
    }
  }, [tenant?.onboarding_data, governanceEditing]);

  const fetchGovernanceStatus = async (token: string) => {
    const response = await fetch("/api/tenants/status", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const summary = parsePolicyApplySummary(payload.policy_apply);
    if (summary) {
      setGovernanceSummary(summary);
    }
  };

  const fetchConnections = async () => {
    try {
      const token = session?.access_token;
      if (!token) return;

      const [connectionsRes, statusRes] = await Promise.all([
        fetch("/api/connections", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/tenants/status", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (connectionsRes.ok) {
        const data = await connectionsRes.json();
        setSlack(
          data.integrations?.slack || {
            connected: false,
            active: false,
            status: "not_connected",
            missing_scopes: [],
            reauthorization_required: false,
          }
        );
        setEmail(data.integrations?.email || { connected: false, inbox: null });
      }

      if (statusRes.ok) {
        const statusPayload = (await statusRes.json()) as Record<string, unknown>;
        const summary = parsePolicyApplySummary(statusPayload.policy_apply);
        if (summary) {
          setGovernanceSummary(summary);
        }
      }
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConnections();
  }, [session]);

  useEffect(() => {
    if (!session?.access_token || governanceSummary?.status !== "pending") {
      return;
    }

    const poll = window.setInterval(() => {
      void fetchGovernanceStatus(session.access_token);
    }, 3000);

    return () => {
      window.clearInterval(poll);
    };
  }, [session?.access_token, governanceSummary?.status]);

  useEffect(() => {
    const slackParam = searchParams.get("slack");
    const errorParam = searchParams.get("error");

    if (slackParam === "connected") {
      toast({
        title: "Slack connected!",
        description: "Slack is connected. Activation is running on your tenant now.",
      });
      setSlack((prev) => ({
        ...prev,
        connected: true,
        active: false,
        status: "activating",
      }));
      void fetchConnections();
      setSearchParams({}, { replace: true });
    } else if (errorParam) {
      toast({
        title: "Connection failed",
        description: `Slack returned an error: ${errorParam}`,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const handleConnectSlack = async () => {
    if (!session?.access_token) return;

    setConnecting(true);
    try {
      const response = await fetch("/api/connections/slack/install", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json();
      if (!response.ok || !payload?.authorize_url) {
        throw new Error(payload?.error || "Failed to start Slack install");
      }

      window.location.assign(payload.authorize_url);
    } catch (error) {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to start Slack install.",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const saveGovernance = async () => {
    if (!session?.access_token) {
      return;
    }

    setGovernanceSaving(true);
    setGovernanceConflict(null);
    setGovernanceError(null);

    try {
      const response = await fetch("/api/tenants/onboarding", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approval_policy: draftPolicy,
          approval_policy_expected_revision: governanceSummary?.revision ?? 1,
        }),
      });
      const payload = (await response.json()) as Record<string, unknown>;

      if (response.status === 409) {
        const message =
          readString(payload.error) ||
          "Governance settings changed in another session. Refresh and try again.";
        setGovernanceConflict(message);
        await refreshTenant();
        await fetchConnections();
        return;
      }

      if (!response.ok) {
        throw new Error(readString(payload.error) || "Failed to save governance settings.");
      }

      const summary = parsePolicyApplySummary(payload.policy_apply);
      if (summary) {
        setGovernanceSummary(summary);
      }

      setGovernanceEditing(false);
      toast({
        title: "Governance saved",
        description: "Approval policy changes were saved and runtime apply was triggered.",
      });

      await refreshTenant();
      await fetchConnections();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save governance settings.";
      setGovernanceError(message);
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setGovernanceSaving(false);
    }
  };

  const retryGovernanceApply = async () => {
    if (!session?.access_token) {
      return;
    }

    setGovernanceSaving(true);
    setGovernanceConflict(null);
    setGovernanceError(null);

    try {
      const response = await fetch("/api/tenants/onboarding", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          force_policy_apply: true,
          approval_policy_expected_revision: governanceSummary?.revision ?? 1,
        }),
      });
      const payload = (await response.json()) as Record<string, unknown>;

      if (response.status === 409) {
        const message =
          readString(payload.error) ||
          "Governance settings changed in another session. Refresh and try again.";
        setGovernanceConflict(message);
        await refreshTenant();
        await fetchConnections();
        return;
      }

      if (!response.ok) {
        throw new Error(readString(payload.error) || "Failed to retry governance apply.");
      }

      const summary = parsePolicyApplySummary(payload.policy_apply);
      if (summary) {
        setGovernanceSummary(summary);
      }

      toast({
        title: "Retry started",
        description: "Runtime apply retry has been triggered.",
      });

      await refreshTenant();
      await fetchConnections();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to retry governance apply.";
      setGovernanceError(message);
      toast({
        title: "Retry failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setGovernanceSaving(false);
    }
  };

  const governanceUiState: GovernanceUiState = useMemo(() => {
    if (loading) {
      return "loading";
    }

    if (governanceSaving) {
      return "saving";
    }

    if (governanceConflict) {
      return "conflict";
    }

    if (governanceEditing) {
      return policyDirty ? "dirty" : "clean";
    }

    if (governanceSummary?.status === "failed") {
      return "failed";
    }

    if (governanceSummary?.status === "pending") {
      return "pending";
    }

    if (governanceSummary?.status === "applied") {
      return "applied";
    }

    return "clean";
  }, [
    governanceConflict,
    governanceEditing,
    governanceSaving,
    governanceSummary?.status,
    loading,
    policyDirty,
  ]);

  const governanceLiveMessage = useMemo(() => {
    if (governanceUiState === "saving") {
      return "Saving governance settings.";
    }
    if (governanceUiState === "pending") {
      return "Governance apply is pending.";
    }
    if (governanceUiState === "applied") {
      return "Governance apply completed.";
    }
    if (governanceUiState === "failed") {
      return "Governance apply failed.";
    }
    if (governanceUiState === "conflict") {
      return "Governance save conflict detected.";
    }
    if (governanceUiState === "dirty") {
      return "Governance form has unsaved changes.";
    }
    return "Governance settings are up to date.";
  }, [governanceUiState]);

  const statusBadgeClass = useMemo(() => {
    if (governanceUiState === "applied") {
      return "bg-emerald-500/15 text-emerald-300 border-0";
    }
    if (governanceUiState === "pending" || governanceUiState === "saving") {
      return "bg-amber-500/15 text-amber-300 border-0";
    }
    if (governanceUiState === "failed" || governanceUiState === "conflict") {
      return "bg-rose-500/15 text-rose-300 border-0";
    }
    if (governanceUiState === "dirty") {
      return "bg-blue-500/15 text-blue-300 border-0";
    }
    return "bg-muted text-muted-foreground border-0";
  }, [governanceUiState]);

  const statusBadgeLabel = useMemo(() => {
    if (governanceUiState === "applied") return "Applied";
    if (governanceUiState === "pending") return "Pending";
    if (governanceUiState === "saving") return "Saving";
    if (governanceUiState === "failed") return "Failed";
    if (governanceUiState === "conflict") return "Conflict";
    if (governanceUiState === "dirty") return "Unsaved";
    return "Ready";
  }, [governanceUiState]);

  const statusDescription = useMemo(() => {
    if (governanceUiState === "saving") {
      return "Saving governance settings and applying runtime policy updates.";
    }

    if (governanceUiState === "pending") {
      return "Runtime apply is queued or in progress.";
    }

    if (governanceUiState === "failed") {
      return governanceSummary?.last_error || "Runtime apply failed. Retry to re-apply policy markers.";
    }

    if (governanceUiState === "conflict") {
      return governanceConflict || "This policy was changed elsewhere. Refresh and save again.";
    }

    if (governanceUiState === "dirty") {
      return "You have unsaved governance changes.";
    }

    if (governanceUiState === "applied") {
      return "Runtime policy was applied successfully.";
    }

    return "Policy settings are ready.";
  }, [governanceConflict, governanceSummary?.last_error, governanceUiState]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Manage your integrations. Connect tools to let your agent work across platforms.
        </p>
      </header>

      {((!slackReady) || !(email.connected && email.inbox)) && (
        <div className="border border-border bg-card rounded-lg p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Loader2 className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Setup in progress</p>
            <p className="text-xs text-muted-foreground">
              {provisioningComplete
                ? slackNeedsReconnect
                  ? "Slack needs a reconnect with the latest permissions before the Chief can be live in workspace conversations."
                  : "Connect your tools to get the most out of your AI Chief of Staff."
                : "Provisioning must finish before Slack can be connected."}
            </p>
          </div>
        </div>
      )}

      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#4A154B]">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Slack</p>
              {slack.status === "active" ? (
                <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>Connected{slack.team_name ? ` to ${slack.team_name}` : ""}</span>
                </div>
              ) : slack.status === "activating" ? (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connected{slack.team_name ? ` to ${slack.team_name}` : ""}, activation in progress</span>
                </div>
              ) : slack.status === "reauthorization_required" ? (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <RefreshCw className="h-4 w-4" />
                  <span>Reconnect required{slack.team_name ? ` for ${slack.team_name}` : ""}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Connect Slack to chat with your agent directly in your workspace.
                </p>
              )}
            </div>
            {slack.status !== "active" && (
              <Button onClick={handleConnectSlack} disabled={connecting || !provisioningComplete || slack.status === "activating"}>
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : !provisioningComplete ? (
                  "Available After Provisioning"
                ) : slackNeedsReconnect ? (
                  "Reconnect Slack"
                ) : slack.status === "activating" ? (
                  "Activation Running"
                ) : (
                  "Connect Slack"
                )}
              </Button>
            )}
          </div>

          {slack.status === "not_connected" && !provisioningComplete && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Slack activation depends on the tenant droplet and gateway being online first. Finish provisioning, then connect Slack here.
              </p>
            </div>
          )}

          {slack.status === "reauthorization_required" && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">Reconnect required</p>
              <p className="text-sm text-muted-foreground">
                The Slack app permissions were expanded for the current Chief behavior. Reconnect this workspace so the Chief can reply in DMs and invited channels truthfully.
              </p>
              {slack.missing_scopes && slack.missing_scopes.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Missing scopes: {slack.missing_scopes.join(", ")}
                </p>
              )}
            </div>
          )}

          {slack.status === "activating" && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">What happens next?</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">→</span>
                  PixelPort is patching the tenant runtime and verifying the Slack connection.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">→</span>
                  The first welcome DM is sent only after tenant readiness and Slack activation both complete.
                </li>
              </ul>
            </div>
          )}

          {slack.status === "active" && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">What happens next?</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  Your Chief is live in Slack
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  DM your Chief directly at any time
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  Invite your Chief into a channel when you want help there
                </li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.open("https://app.slack.com", "_blank")}
              >
                Open Slack
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">Email</p>
            {email.connected && email.inbox ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15 border-0">Active</Badge>
                <span className="truncate">— {email.inbox}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Email is automatically set up when your agent is provisioned.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-6 space-y-5">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {governanceLiveMessage}
          </p>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                {governanceUiState === "saving" || governanceUiState === "pending" ? (
                  <Loader2 className="h-5 w-5 text-amber-300 animate-spin" />
                ) : governanceUiState === "failed" || governanceUiState === "conflict" ? (
                  <AlertTriangle className="h-5 w-5 text-rose-300" />
                ) : governanceUiState === "applied" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-300" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-amber-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Governance</p>
                <p className="text-sm text-muted-foreground">{statusDescription}</p>
              </div>
            </div>
            <Badge className={statusBadgeClass}>{statusBadgeLabel}</Badge>
          </div>

          <div className="rounded-xl border border-border bg-[hsl(240_14%_6%)] p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Policy summary</p>
            <p className="text-sm text-foreground font-medium">Mode: {getModeLabel(savedPolicy.mode)}</p>
            <p className="text-sm text-muted-foreground">{getGuardrailSummary(savedPolicy)}</p>
            <p className="text-xs text-muted-foreground">
              Last applied: {formatTimestamp(governanceSummary?.last_applied_at ?? null)}
            </p>
          </div>

          {governanceEditing && (
            <div className="rounded-xl border border-border bg-[hsl(240_14%_6%)] p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {APPROVAL_MODE_OPTIONS.map((mode) => {
                  const selected = draftPolicy.mode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setDraftPolicy((current) => ({
                          ...current,
                          mode: mode.id,
                        }));
                      }}
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
                    className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-[hsl(240_14%_5%)] px-3 py-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={draftPolicy.guardrails[guardrail.key]}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraftPolicy((current) => ({
                          ...current,
                          guardrails: {
                            ...current.guardrails,
                            [guardrail.key]: checked,
                          },
                        }));
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(38_60%_58%)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{guardrail.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{guardrail.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {governanceSummary?.last_error && !governanceEditing && governanceUiState === "failed" && (
            <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-200">
              {governanceSummary.last_error}
            </div>
          )}

          {governanceConflict && (
            <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-200">
              {governanceConflict}
            </div>
          )}

          {governanceError && (
            <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-200">
              {governanceError}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {governanceEditing ? (
              <>
                <Button
                  className="min-h-11"
                  onClick={saveGovernance}
                  disabled={!policyDirty || governanceSaving}
                >
                  {governanceSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Governance"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setDraftPolicy(savedPolicy);
                    setGovernanceEditing(false);
                    setGovernanceConflict(null);
                    setGovernanceError(null);
                  }}
                  disabled={governanceSaving}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setGovernanceEditing(true);
                    setGovernanceConflict(null);
                    setGovernanceError(null);
                  }}
                  disabled={governanceSaving}
                >
                  Edit Governance
                </Button>
                {governanceUiState === "failed" && (
                  <Button
                    className="min-h-11"
                    onClick={retryGovernanceApply}
                    disabled={governanceSaving}
                  >
                    {governanceSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Retrying…
                      </>
                    ) : (
                      "Retry Apply"
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Connections;
