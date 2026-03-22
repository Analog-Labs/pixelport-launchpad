import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PixelPortLogo from "@/components/PixelPortLogo";
import StepIndicator from "@/components/onboarding/StepIndicator";
import StepCompanyInfo from "@/components/onboarding/StepCompanyInfo";
import StepProvisioning from "@/components/onboarding/StepProvisioning";
import StepTaskSetup, { type AgentSuggestionInput } from "@/components/onboarding/StepTaskSetup";
import StepConnectTools from "@/components/onboarding/StepConnectTools";
import { getPostAuthRedirectPath } from "@/lib/dashboard-redirect";
import { resolveTaskStepUnlocked, type TenantStatusResponse } from "@/lib/runtime-bridge-contract";

interface OnboardingFormData {
  company_name: string;
  company_url: string;
  mission_goals: string;
  agent_name: string;
  starter_task: string;
  agent_suggestions: AgentSuggestionInput[];
}

interface RuntimeHandoffResponse {
  error?: string;
  paperclip_runtime_url?: string;
  workspace_launch_url?: string;
  handoff_token?: string;
}

const DEFAULT_AGENT_NAME = "Luna";
const POLL_INTERVAL_MS = 5000;

function createSuggestionId(): string {
  return `agent-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readBootstrapStatus(onboardingData: Record<string, unknown> | null | undefined): string | null {
  if (!isRecord(onboardingData) || !isRecord(onboardingData.bootstrap)) {
    return null;
  }

  const status = readString(onboardingData.bootstrap.status).trim();
  return status || null;
}

function isLaunchCompleted(onboardingData: Record<string, unknown> | null | undefined): boolean {
  return readString(onboardingData?.launch_completed_at).trim().length > 0;
}

function resolveWorkspaceUrl(rawUrl: unknown): string | null {
  const trimmed = readString(rawUrl).trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveWorkspaceHandoffUrl(rawRuntimeUrl: unknown, rawHandoffToken: unknown): string | null {
  const runtimeUrl = resolveWorkspaceUrl(rawRuntimeUrl);
  const handoffToken = readString(rawHandoffToken).trim();

  if (!runtimeUrl || !handoffToken) {
    return null;
  }

  const handoffUrl = new URL("/pixelport/handoff", runtimeUrl);
  handoffUrl.searchParams.set("handoff_token", handoffToken);
  handoffUrl.searchParams.set("next", "/");
  return handoffUrl.toString();
}

function toGoalsArray(missionGoals: string): string[] {
  const trimmed = missionGoals.trim();
  if (!trimmed) {
    return [];
  }

  const tokens = trimmed
    .split(/\n|,/)
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.length > 0 ? tokens.slice(0, 8) : [trimmed];
}

function missionGoalsFromOnboarding(onboardingData: Record<string, unknown>): string {
  const direct = readString(onboardingData.mission_goals).trim();
  if (direct) {
    return direct;
  }

  const legacyMission = readString(onboardingData.mission).trim();
  if (legacyMission) {
    return legacyMission;
  }

  if (!Array.isArray(onboardingData.goals)) {
    return "";
  }

  const goals = onboardingData.goals
    .filter((goal): goal is string => typeof goal === "string")
    .map((goal) => goal.trim())
    .filter(Boolean);

  return goals.join("\n");
}

function buildStarterTask(companyName: string, missionGoals: string): string {
  const safeCompanyName = companyName.trim() || "the company";
  const safeGoal = missionGoals.trim() || "the top marketing priorities";
  return `Create a focused 14-day plan for ${safeCompanyName} aligned to: ${safeGoal}.`;
}

function buildDefaultAgentSuggestions(agentName: string): AgentSuggestionInput[] {
  const baseName = agentName.trim() || DEFAULT_AGENT_NAME;

  return [
    {
      id: createSuggestionId(),
      role: "Chief of Staff",
      name: baseName,
      focus: "Own weekly priorities and coordinate execution across the team.",
    },
    {
      id: createSuggestionId(),
      role: "Content Specialist",
      name: `${baseName} Content`,
      focus: "Plan and draft high-leverage content for active campaigns.",
    },
    {
      id: createSuggestionId(),
      role: "Growth Specialist",
      name: `${baseName} Growth`,
      focus: "Identify growth experiments and convert wins into repeatable playbooks.",
    },
  ];
}

function normalizeAgentSuggestions(value: unknown, fallbackAgentName: string): AgentSuggestionInput[] {
  if (!Array.isArray(value)) {
    return buildDefaultAgentSuggestions(fallbackAgentName);
  }

  const parsed = value
    .filter(isRecord)
    .map((item) => ({
      id: readString(item.id) || createSuggestionId(),
      role: readString(item.role),
      name: readString(item.name),
      focus: readString(item.focus),
    }))
    .filter((item) => item.role.trim() || item.name.trim() || item.focus.trim());

  return parsed.length > 0 ? parsed : buildDefaultAgentSuggestions(fallbackAgentName);
}

function getInitialFormState(): OnboardingFormData {
  return {
    company_name: "",
    company_url: "",
    mission_goals: "",
    agent_name: DEFAULT_AGENT_NAME,
    starter_task: "",
    agent_suggestions: [],
  };
}

function buildFormStateFromTenant(tenantName: string, onboardingData: Record<string, unknown>): OnboardingFormData {
  const companyName = readString(onboardingData.company_name).trim() || tenantName;
  const missionGoals = missionGoalsFromOnboarding(onboardingData);
  const agentName = readString(onboardingData.agent_name).trim() || DEFAULT_AGENT_NAME;
  const starterTask = readString(onboardingData.starter_task).trim() || buildStarterTask(companyName, missionGoals);

  return {
    company_name: companyName,
    company_url: readString(onboardingData.company_url),
    mission_goals: missionGoals,
    agent_name: agentName,
    starter_task: starterTask,
    agent_suggestions: normalizeAgentSuggestions(onboardingData.agent_suggestions, agentName),
  };
}

const Onboarding = () => {
  const {
    user,
    session,
    tenant,
    loading: authLoading,
    tenantLoading,
    refreshTenant,
  } = useAuth();
  const location = useLocation();

  const [step, setStep] = useState(1);
  const [fadeIn, setFadeIn] = useState(true);

  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [companyError, setCompanyError] = useState("");

  const [provisionStatus, setProvisionStatus] = useState<string | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null);
  const [taskStepUnlocked, setTaskStepUnlocked] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [provisionPolling, setProvisionPolling] = useState(false);
  const [provisionError, setProvisionError] = useState("");

  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  const [data, setData] = useState<OnboardingFormData>(() => getInitialFormState());

  const hydratedTenantIdRef = useRef<string | null>(null);
  const redirectPath = getPostAuthRedirectPath(location.state);

  const effectiveProvisionStatus = provisionStatus ?? tenant?.status ?? null;
  const tenantOnboardingData = isRecord(tenant?.onboarding_data) ? tenant.onboarding_data : null;
  const effectiveBootstrapStatus = bootstrapStatus ?? readBootstrapStatus(tenantOnboardingData);
  const provisioningReady = resolveTaskStepUnlocked({
    status: effectiveProvisionStatus,
    bootstrapStatus: effectiveBootstrapStatus,
    taskStepUnlocked,
  });

  const changeStep = useCallback((next: number) => {
    setFadeIn(false);
    setTimeout(() => {
      setStep(next);
      setFadeIn(true);
    }, 200);
  }, []);

  const patch = (patchValue: Partial<OnboardingFormData>) => {
    setData((current) => ({ ...current, ...patchValue }));
  };

  const ensureTaskDefaults = useCallback(() => {
    setData((current) => {
      const seededTask = current.starter_task.trim()
        ? current.starter_task
        : buildStarterTask(current.company_name, current.mission_goals);
      const seededSuggestions = current.agent_suggestions.length > 0
        ? current.agent_suggestions
        : buildDefaultAgentSuggestions(current.agent_name);

      if (seededTask === current.starter_task && seededSuggestions === current.agent_suggestions) {
        return current;
      }

      return {
        ...current,
        starter_task: seededTask,
        agent_suggestions: seededSuggestions,
      };
    });
  }, []);

  const goToTaskStep = useCallback(() => {
    ensureTaskDefaults();
    changeStep(3);
  }, [changeStep, ensureTaskDefaults]);

  const pollProvisionStatus = useCallback(async () => {
    if (!session?.access_token || !tenant) {
      return;
    }

    setProvisionPolling(true);
    setProvisionError("");

    try {
      const res = await fetch("/api/tenants/status", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = (await res.json()) as TenantStatusResponse;

      if (!res.ok) {
        throw new Error(payload.error || "Failed to check provisioning status.");
      }

      const nextStatus = typeof payload.status === "string" ? payload.status : tenant.status;
      const nextBootstrapStatus = typeof payload.bootstrap_status === "string" ? payload.bootstrap_status : null;
      const nextTaskStepUnlocked = resolveTaskStepUnlocked({
        status: nextStatus,
        bootstrapStatus: nextBootstrapStatus,
        taskStepUnlocked: payload.task_step_unlocked,
      });
      setProvisionStatus(nextStatus);
      setBootstrapStatus(nextBootstrapStatus);
      setTaskStepUnlocked(nextTaskStepUnlocked);
      setLastCheckedAt(new Date().toISOString());

      if (nextTaskStepUnlocked) {
        await refreshTenant();
      }
    } catch (error) {
      setProvisionError(error instanceof Error ? error.message : "Failed to check provisioning status.");
    } finally {
      setProvisionPolling(false);
    }
  }, [refreshTenant, session?.access_token, tenant]);

  const handleCompanySubmit = async () => {
    setCompanyError("");
    setLaunchError("");

    if (!session?.access_token) {
      setCompanyError("Your session expired. Please sign in again.");
      return;
    }

    const companyName = data.company_name.trim();
    const companyUrl = data.company_url.trim();
    const missionGoals = data.mission_goals.trim();
    const agentName = data.agent_name.trim() || DEFAULT_AGENT_NAME;

    setCompanySubmitting(true);

    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_name: companyName,
          company_url: companyUrl || null,
          mission: missionGoals,
          mission_goals: missionGoals,
          goals: toGoalsArray(missionGoals),
          agent_name: agentName,
        }),
      });

      const payload = (await res.json()) as { error?: string; tenant?: { status?: string } };

      if (!res.ok) {
        throw new Error(payload.error || "Failed to create your workspace.");
      }

      setData((current) => {
        const seededTask = current.starter_task.trim() || buildStarterTask(companyName, missionGoals);
        const seededSuggestions = current.agent_suggestions.length > 0
          ? current.agent_suggestions
          : buildDefaultAgentSuggestions(agentName);

        return {
          ...current,
          company_name: companyName,
          company_url: companyUrl,
          mission_goals: missionGoals,
          agent_name: agentName,
          starter_task: seededTask,
          agent_suggestions: seededSuggestions,
        };
      });

      setProvisionStatus(payload.tenant?.status || "provisioning");
      setBootstrapStatus(null);
      setTaskStepUnlocked(false);
      setLastCheckedAt(new Date().toISOString());

      await refreshTenant();
      changeStep(2);
    } catch (error) {
      setCompanyError(error instanceof Error ? error.message : "Failed to start provisioning.");
    } finally {
      setCompanySubmitting(false);
    }
  };

  const handleLaunch = async () => {
    setLaunchError("");

    if (!session?.access_token) {
      setLaunchError("Your session expired. Please sign in again.");
      return;
    }

    if (!tenant) {
      setLaunchError("Tenant record not found. Please restart onboarding.");
      return;
    }

    setLaunching(true);

    try {
      const existingOnboarding = isRecord(tenant.onboarding_data) ? tenant.onboarding_data : {};
      const cleanAgentName = data.agent_name.trim() || DEFAULT_AGENT_NAME;
      const cleanMissionGoals = data.mission_goals.trim();
      const cleanStarterTask = data.starter_task.trim() || buildStarterTask(data.company_name, cleanMissionGoals);
      const cleanSuggestions = data.agent_suggestions
        .map((suggestion) => ({
          id: suggestion.id,
          role: suggestion.role.trim(),
          name: suggestion.name.trim(),
          focus: suggestion.focus.trim(),
        }))
        .filter((suggestion) => suggestion.role || suggestion.name || suggestion.focus);

      const basePayload = {
        ...existingOnboarding,
        company_name: data.company_name.trim(),
        company_url: data.company_url.trim() || null,
        mission_goals: cleanMissionGoals,
        goals: toGoalsArray(cleanMissionGoals),
        agent_name: cleanAgentName,
        starter_task: cleanStarterTask,
        agent_suggestions: cleanSuggestions.length > 0 ? cleanSuggestions : buildDefaultAgentSuggestions(cleanAgentName),
      };

      const handoffRes = await fetch("/api/runtime/handoff", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source: "onboarding-launch" }),
      });

      let handoffResult: RuntimeHandoffResponse = {};
      try {
        handoffResult = (await handoffRes.json()) as RuntimeHandoffResponse;
      } catch {
        handoffResult = {};
      }

      if (!handoffRes.ok) {
        throw new Error(handoffResult.error || "Failed to open your workspace.");
      }

      const workspaceUrl = resolveWorkspaceUrl(handoffResult.workspace_launch_url)
        ?? resolveWorkspaceHandoffUrl(
          handoffResult.paperclip_runtime_url,
          handoffResult.handoff_token,
        );
      if (!workspaceUrl) {
        throw new Error("Workspace launch URL is unavailable for this tenant.");
      }

      const payload = {
        ...basePayload,
        launch_completed_at: new Date().toISOString(),
      };

      const saveRes = await fetch("/api/tenants/onboarding", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let saveResult: { error?: string } = {};
      try {
        saveResult = (await saveRes.json()) as { error?: string };
      } catch {
        saveResult = {};
      }

      if (!saveRes.ok) {
        throw new Error(saveResult.error || "Failed to save onboarding setup.");
      }

      window.location.assign(workspaceUrl);
      return;
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "Failed to finalize onboarding.");
    } finally {
      setLaunching(false);
    }
  };

  useEffect(() => {
    if (!tenant || !session?.access_token || provisioningReady) {
      return;
    }

    void pollProvisionStatus();

    const interval = setInterval(() => {
      void pollProvisionStatus();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [pollProvisionStatus, provisioningReady, session?.access_token, tenant]);

  useEffect(() => {
    if (!tenant) {
      hydratedTenantIdRef.current = null;
      return;
    }

    setProvisionStatus(tenant.status);
    const onboardingData = isRecord(tenant.onboarding_data) ? tenant.onboarding_data : {};
    const bootstrapFromTenant = readBootstrapStatus(onboardingData);
    const nextTaskStepUnlocked = resolveTaskStepUnlocked({
      status: tenant.status,
      bootstrapStatus: bootstrapFromTenant,
    });
    setBootstrapStatus(bootstrapFromTenant);
    setTaskStepUnlocked(nextTaskStepUnlocked);

    if (hydratedTenantIdRef.current === tenant.id) {
      return;
    }

    setData(buildFormStateFromTenant(tenant.name, onboardingData));
    setStep(nextTaskStepUnlocked ? 3 : 2);
    hydratedTenantIdRef.current = tenant.id;
  }, [tenant]);

  useEffect(() => {
    if (step > 2 && !provisioningReady) {
      setStep(2);
    }
  }, [provisioningReady, step]);

  if (authLoading || tenantLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const onboardingData = isRecord(tenant?.onboarding_data) ? tenant.onboarding_data : null;
  const tenantProvisionReady = resolveTaskStepUnlocked({
    status: tenant?.status,
    bootstrapStatus: readBootstrapStatus(onboardingData),
  });
  if (tenant && tenantProvisionReady && isLaunchCompleted(onboardingData)) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, hsla(38,60%,58%,0.08) 0%, transparent 70%)" }}
      />

      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2.5 z-10">
        <PixelPortLogo className="h-8 w-8" />
        <span className="text-xl font-bold text-foreground tracking-tight">PixelPort</span>
      </Link>

      <div
        className="w-full max-w-[640px] rounded-2xl border bg-card p-6 sm:p-10 relative z-10"
        style={{ borderColor: "rgba(212,168,83,0.15)" }}
      >
        <StepIndicator currentStep={step} />

        <div
          className="transition-all duration-200"
          style={{ opacity: fadeIn ? 1 : 0, transform: fadeIn ? "translateY(0)" : "translateY(8px)" }}
        >
          {step === 1 && (
            <StepCompanyInfo
              data={data}
              onChange={patch}
              onNext={handleCompanySubmit}
              submitting={companySubmitting}
              error={companyError}
            />
          )}

          {step === 2 && (
            <StepProvisioning
              companyName={data.company_name}
              agentName={data.agent_name}
              status={effectiveProvisionStatus || "provisioning"}
              bootstrapStatus={bootstrapStatus}
              ready={provisioningReady}
              polling={provisionPolling}
              lastCheckedAt={lastCheckedAt}
              error={provisionError}
              onRefresh={() => {
                void pollProvisionStatus();
              }}
              onNext={goToTaskStep}
            />
          )}

          {step === 3 && (
            <StepTaskSetup
              companyName={data.company_name}
              starterTask={data.starter_task}
              suggestions={data.agent_suggestions}
              onStarterTaskChange={(value) => patch({ starter_task: value })}
              onSuggestionChange={(id, suggestionPatch) => {
                setData((current) => ({
                  ...current,
                  agent_suggestions: current.agent_suggestions.map((item) => (
                    item.id === id ? { ...item, ...suggestionPatch } : item
                  )),
                }));
              }}
              onAddSuggestion={() => {
                setData((current) => ({
                  ...current,
                  agent_suggestions: [
                    ...current.agent_suggestions,
                    {
                      id: createSuggestionId(),
                      role: "Specialist",
                      name: `${(current.agent_name || DEFAULT_AGENT_NAME).trim()} Specialist`,
                      focus: "Add a custom focus area.",
                    },
                  ],
                }));
              }}
              onRemoveSuggestion={(id) => {
                setData((current) => ({
                  ...current,
                  agent_suggestions: current.agent_suggestions.filter((item) => item.id !== id),
                }));
              }}
              onBack={() => changeStep(2)}
              onNext={() => changeStep(4)}
            />
          )}

          {step === 4 && (
            <StepConnectTools
              companyName={data.company_name}
              agentName={data.agent_name}
              starterTask={data.starter_task}
              suggestionCount={data.agent_suggestions.length}
              launching={launching}
              error={launchError}
              onBack={() => changeStep(3)}
              onLaunch={handleLaunch}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
