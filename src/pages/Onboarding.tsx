import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PixelPortLogo from "@/components/PixelPortLogo";
import StepIndicator from "@/components/onboarding/StepIndicator";
import StepCompanyInfo from "@/components/onboarding/StepCompanyInfo";
import StepStrategy from "@/components/onboarding/StepStrategy";
import StepTaskSetup, { type AgentSuggestionInput } from "@/components/onboarding/StepTaskSetup";
import StepConnectTools from "@/components/onboarding/StepConnectTools";
import { getPostAuthRedirectPath } from "@/lib/dashboard-redirect";
import {
  TENANT_STATUS,
  isTenantProvisioningComplete,
  isTenantProvisioningInFlight,
} from "@/lib/tenant-status";

interface TenantStatusResponse {
  status?: string | null;
  bootstrap_status?: string | null;
  error?: string;
}

interface ScanResponse {
  scan_results?: Record<string, unknown>;
  error?: string;
}

interface OnboardingFormData {
  company_name: string;
  company_url: string;
  agent_name: string;
  mission_goals: string;
  products_services_text: string;
  starter_task: string;
  agent_suggestions: AgentSuggestionInput[];
  scan_results: Record<string, unknown> | null;
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

function readNullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  const parsed = readString(value).trim();
  return parsed.length > 0 ? parsed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
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

  return tokens.slice(0, 8);
}

function toProductsArray(productsServicesText: string): string[] {
  return productsServicesText
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function productsTextFromArray(products: string[]): string {
  return products.join("\n");
}

function readBootstrapStatus(onboardingData: Record<string, unknown> | null | undefined): string | null {
  if (!isRecord(onboardingData) || !isRecord(onboardingData.bootstrap)) {
    return null;
  }

  const status = readString(onboardingData.bootstrap.status).trim();
  return status || null;
}

function readLaunchStarted(onboardingData: Record<string, unknown> | null | undefined): string | null {
  if (!isRecord(onboardingData)) {
    return null;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.launch)) {
    const nested = readNullableString(onboardingData.v2.launch.started_at);
    if (nested) {
      return nested;
    }
  }

  return readNullableString(onboardingData.launch_started_at);
}

function readLaunchCompleted(onboardingData: Record<string, unknown> | null | undefined): string | null {
  if (!isRecord(onboardingData)) {
    return null;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.launch)) {
    const nested = readNullableString(onboardingData.v2.launch.completed_at);
    if (nested) {
      return nested;
    }
  }

  return readNullableString(onboardingData.launch_completed_at);
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

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.strategy)) {
    const nested = readString(onboardingData.v2.strategy.mission_goals).trim();
    if (nested) {
      return nested;
    }
  }

  return "";
}

function extractProductsFromScan(scanResults: Record<string, unknown> | null): string[] {
  if (!scanResults) {
    return [];
  }

  const keyProducts = normalizeStringArray(scanResults.key_products);
  if (keyProducts.length > 0) {
    return keyProducts;
  }

  return normalizeStringArray(scanResults.products_services);
}

function productsFromOnboarding(onboardingData: Record<string, unknown>): string[] {
  const flatProducts = normalizeStringArray(onboardingData.products_services);
  if (flatProducts.length > 0) {
    return flatProducts;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.strategy)) {
    const nestedProducts = normalizeStringArray(onboardingData.v2.strategy.products_services);
    if (nestedProducts.length > 0) {
      return nestedProducts;
    }
  }

  const scanResults = isRecord(onboardingData.scan_results) ? onboardingData.scan_results : null;
  return extractProductsFromScan(scanResults);
}

function scanResultsFromOnboarding(onboardingData: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(onboardingData.scan_results)) {
    return onboardingData.scan_results;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.strategy) && isRecord(onboardingData.v2.strategy.scan_results)) {
    return onboardingData.v2.strategy.scan_results;
  }

  return null;
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
    return [];
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

function hasCompanyData(onboardingData: Record<string, unknown>, fallbackCompanyName?: string): boolean {
  const flatCompanyName = readString(onboardingData.company_name).trim();
  if (flatCompanyName.length > 0) {
    return true;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.company)) {
    const nestedCompanyName = readString(onboardingData.v2.company.name).trim();
    if (nestedCompanyName.length > 0) {
      return true;
    }
  }

  return readString(fallbackCompanyName).trim().length > 0;
}

function isStrategyStepComplete(onboardingData: Record<string, unknown>): boolean {
  return missionGoalsFromOnboarding(onboardingData).trim().length >= 3;
}

function getInitialFormState(): OnboardingFormData {
  return {
    company_name: "",
    company_url: "",
    agent_name: DEFAULT_AGENT_NAME,
    mission_goals: "",
    products_services_text: "",
    starter_task: "",
    agent_suggestions: [],
    scan_results: null,
  };
}

function buildFormStateFromTenant(tenantName: string, onboardingData: Record<string, unknown>): OnboardingFormData {
  const companyName = readString(onboardingData.company_name).trim() || tenantName;
  const missionGoals = missionGoalsFromOnboarding(onboardingData);
  const agentName = readString(onboardingData.agent_name).trim() || DEFAULT_AGENT_NAME;
  const starterTask = readString(onboardingData.starter_task).trim() || buildStarterTask(companyName, missionGoals);
  const suggestions = normalizeAgentSuggestions(onboardingData.agent_suggestions, agentName);

  return {
    company_name: companyName,
    company_url: readString(onboardingData.company_url),
    agent_name: agentName,
    mission_goals: missionGoals,
    products_services_text: productsTextFromArray(productsFromOnboarding(onboardingData)),
    starter_task: starterTask,
    agent_suggestions: suggestions.length > 0 ? suggestions : buildDefaultAgentSuggestions(agentName),
    scan_results: scanResultsFromOnboarding(onboardingData),
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
  const [data, setData] = useState<OnboardingFormData>(() => getInitialFormState());

  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [companyError, setCompanyError] = useState("");

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [scanState, setScanState] = useState<"idle" | "scanning" | "done" | "failed">("idle");
  const [scanError, setScanError] = useState("");

  const [launching, setLaunching] = useState(false);
  const [launchStarted, setLaunchStarted] = useState(false);
  const [launchError, setLaunchError] = useState("");

  const [provisionStatus, setProvisionStatus] = useState<string | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null);
  const [provisionPolling, setProvisionPolling] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const hydratedTenantIdRef = useRef<string | null>(null);
  const launchCompletionMarkedRef = useRef(false);
  const redirectPath = getPostAuthRedirectPath(location.state);

  const effectiveStatus = provisionStatus ?? tenant?.status ?? null;
  const provisioningComplete = isTenantProvisioningComplete(effectiveStatus);
  const tenantOnboardingData = isRecord(tenant?.onboarding_data) ? tenant.onboarding_data : null;

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

  const saveOnboardingPatch = useCallback(
    async (
      patchPayload: Record<string, unknown>,
      options?: {
        refreshTenantAfter?: boolean;
        silent?: boolean;
      }
    ): Promise<boolean> => {
      if (!session?.access_token) {
        setSaveState("error");
        setSaveError("Your session expired. Please sign in again.");
        return false;
      }

      if (!options?.silent) {
        setSaveState("saving");
        setSaveError("");
      }

      try {
        const response = await fetch("/api/tenants/onboarding", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchPayload),
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to save onboarding data.");
        }

        if (!options?.silent) {
          setSaveState("saved");
          setLastSavedAt(new Date().toISOString());
        }

        if (options?.refreshTenantAfter !== false) {
          await refreshTenant();
        }

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save onboarding data.";
        if (!options?.silent) {
          setSaveState("error");
        }
        setSaveError(message);
        return false;
      }
    },
    [refreshTenant, session?.access_token]
  );

  const runWebsiteScan = useCallback(
    async (companyUrl: string) => {
      const trimmedUrl = companyUrl.trim();
      if (!trimmedUrl || !session?.access_token) {
        return;
      }

      setScanState("scanning");
      setScanError("");

      try {
        const response = await fetch("/api/tenants/scan", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ company_url: trimmedUrl }),
        });

        const payload = (await response.json()) as ScanResponse;
        if (!response.ok || !isRecord(payload.scan_results)) {
          throw new Error(payload.error || "Scan did not return usable data.");
        }

        const scanResults = payload.scan_results;
        const scannedProducts = extractProductsFromScan(scanResults);

        let nextProductsText = data.products_services_text;
        setData((current) => {
          const shouldPrefillProducts = current.products_services_text.trim().length === 0 && scannedProducts.length > 0;
          if (shouldPrefillProducts) {
            nextProductsText = productsTextFromArray(scannedProducts);
          }

          return {
            ...current,
            scan_results: scanResults,
            products_services_text: shouldPrefillProducts ? nextProductsText : current.products_services_text,
          };
        });

        const patchPayload: Record<string, unknown> = {
          scan_results: scanResults,
        };

        if (nextProductsText.trim().length > 0) {
          patchPayload.products_services = toProductsArray(nextProductsText);
        }

        await saveOnboardingPatch(patchPayload, { silent: true });
        setScanState("done");
      } catch (error) {
        setScanState("failed");
        setScanError(error instanceof Error ? error.message : "Website scan failed.");
      }
    },
    [data.products_services_text, saveOnboardingPatch, session?.access_token]
  );

  const buildStrategyPatch = useCallback(() => {
    const missionGoals = data.mission_goals.trim();
    return {
      mission_goals: missionGoals,
      goals: toGoalsArray(missionGoals),
      products_services: toProductsArray(data.products_services_text),
      scan_results: data.scan_results,
    };
  }, [data.mission_goals, data.products_services_text, data.scan_results]);

  const buildTaskPatch = useCallback(() => {
    const cleanSuggestions = data.agent_suggestions
      .map((suggestion) => ({
        id: suggestion.id,
        role: suggestion.role.trim(),
        name: suggestion.name.trim(),
        focus: suggestion.focus.trim(),
      }))
      .filter((suggestion) => suggestion.role || suggestion.name || suggestion.focus);

    return {
      starter_task: data.starter_task.trim() || buildStarterTask(data.company_name, data.mission_goals),
      agent_suggestions:
        cleanSuggestions.length > 0 ? cleanSuggestions : buildDefaultAgentSuggestions(data.agent_name),
    };
  }, [data.agent_name, data.agent_suggestions, data.company_name, data.mission_goals, data.starter_task]);

  const pollProvisionStatus = useCallback(async () => {
    if (!session?.access_token || !tenant) {
      return;
    }

    setProvisionPolling(true);

    try {
      const response = await fetch("/api/tenants/status", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = (await response.json()) as TenantStatusResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to check provisioning status.");
      }

      const nextStatus = typeof payload.status === "string" ? payload.status : tenant.status;
      const nextBootstrapStatus = typeof payload.bootstrap_status === "string" ? payload.bootstrap_status : null;

      setProvisionStatus(nextStatus);
      setBootstrapStatus(nextBootstrapStatus);
      setLastCheckedAt(new Date().toISOString());

      if (isTenantProvisioningComplete(nextStatus)) {
        if (!launchCompletionMarkedRef.current) {
          launchCompletionMarkedRef.current = true;
          const completedAt = new Date().toISOString();
          await saveOnboardingPatch(
            {
              launch_completed_at: completedAt,
              v2: {
                launch: {
                  completed_at: completedAt,
                },
              },
            },
            { silent: true }
          );
        }

        window.location.assign(redirectPath);
      }
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "Failed to check provisioning status.");
    } finally {
      setProvisionPolling(false);
    }
  }, [redirectPath, saveOnboardingPatch, session?.access_token, tenant]);

  const handleCompanySubmit = async () => {
    setCompanyError("");
    setSaveError("");

    if (!session?.access_token) {
      setCompanyError("Your session expired. Please sign in again.");
      return;
    }

    const companyName = data.company_name.trim();
    const companyUrl = data.company_url.trim();
    const agentName = data.agent_name.trim() || DEFAULT_AGENT_NAME;

    setCompanySubmitting(true);

    try {
      if (!tenant) {
        const createResponse = await fetch("/api/tenants", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_name: companyName,
            company_url: companyUrl || null,
            agent_name: agentName,
          }),
        });

        const createPayload = (await createResponse.json()) as { error?: string; tenant?: { status?: string } };
        if (!createResponse.ok) {
          throw new Error(createPayload.error || "Failed to create draft tenant.");
        }

        setProvisionStatus(createPayload.tenant?.status || TENANT_STATUS.DRAFT);
      }

      const saved = await saveOnboardingPatch(
        {
          company_name: companyName,
          company_url: companyUrl || null,
          agent_name: agentName,
        },
        { refreshTenantAfter: false }
      );

      if (!saved) {
        return;
      }

      setData((current) => ({
        ...current,
        company_name: companyName,
        company_url: companyUrl,
        agent_name: agentName,
        starter_task: current.starter_task.trim() || buildStarterTask(companyName, current.mission_goals),
        agent_suggestions:
          current.agent_suggestions.length > 0
            ? current.agent_suggestions
            : buildDefaultAgentSuggestions(agentName),
      }));

      await refreshTenant();
      changeStep(2);

      if (companyUrl) {
        void runWebsiteScan(companyUrl);
      }
    } catch (error) {
      setCompanyError(error instanceof Error ? error.message : "Failed to save company details.");
    } finally {
      setCompanySubmitting(false);
    }
  };

  const handleStrategyNext = async () => {
    setLaunchError("");
    const saved = await saveOnboardingPatch(buildStrategyPatch());
    if (saved) {
      changeStep(3);
    }
  };

  const handleStrategyBack = async () => {
    await saveOnboardingPatch(buildStrategyPatch());
    changeStep(1);
  };

  const handleTaskNext = async () => {
    const saved = await saveOnboardingPatch(buildTaskPatch());
    if (saved) {
      changeStep(4);
    }
  };

  const handleTaskBack = async () => {
    await saveOnboardingPatch(buildTaskPatch());
    changeStep(2);
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
      const launchResponse = await fetch("/api/tenants/launch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const launchPayload = (await launchResponse.json()) as {
        error?: string;
        status?: string;
      };

      if (!launchResponse.ok) {
        throw new Error(launchPayload.error || "Failed to start launch provisioning.");
      }

      setLaunchStarted(true);
      setProvisionStatus(typeof launchPayload.status === "string" ? launchPayload.status : TENANT_STATUS.PROVISIONING);
      setLastCheckedAt(new Date().toISOString());

      await refreshTenant();
      void pollProvisionStatus();
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "Failed to start launch provisioning.");
    } finally {
      setLaunching(false);
    }
  };

  useEffect(() => {
    if (!launchStarted || provisioningComplete || !tenant || !session?.access_token) {
      return;
    }

    const interval = setInterval(() => {
      void pollProvisionStatus();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [launchStarted, pollProvisionStatus, provisioningComplete, session?.access_token, tenant]);

  useEffect(() => {
    if (!tenant) {
      hydratedTenantIdRef.current = null;
      setLaunchStarted(false);
      return;
    }

    setProvisionStatus(tenant.status);

    const onboardingData = isRecord(tenant.onboarding_data) ? tenant.onboarding_data : {};
    setBootstrapStatus(readBootstrapStatus(onboardingData));

    if (hydratedTenantIdRef.current !== tenant.id) {
      setData(buildFormStateFromTenant(tenant.name, onboardingData));
      hydratedTenantIdRef.current = tenant.id;
    }

    const hasLaunchStarted =
      !!readLaunchStarted(onboardingData) ||
      isTenantProvisioningInFlight(tenant.status) ||
      isTenantProvisioningComplete(tenant.status);

    setLaunchStarted(hasLaunchStarted);

    if (hasLaunchStarted) {
      setStep(4);
      return;
    }

    if (!hasCompanyData(onboardingData, tenant.name)) {
      setStep(1);
      return;
    }

    if (!isStrategyStepComplete(onboardingData)) {
      setStep(2);
      return;
    }

    setStep(3);
  }, [tenant]);

  if (authLoading || tenantLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const launchCompletedAt = readLaunchCompleted(tenantOnboardingData);
  if (tenant && isTenantProvisioningComplete(tenant.status) && launchCompletedAt) {
    return <Navigate to={redirectPath} replace />;
  }

  const saveStatusText =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
      ? `Saved${lastSavedAt ? ` at ${new Date(lastSavedAt).toLocaleTimeString()}` : ""}`
      : saveState === "error"
      ? "Needs retry"
      : "Draft";

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
        className="w-full max-w-[760px] rounded-2xl border bg-card p-6 sm:p-10 relative z-10"
        style={{ borderColor: "rgba(212,168,83,0.15)" }}
      >
        <div className="flex justify-end mb-4">
          <div className={`text-xs rounded-full px-3 py-1 border ${saveState === "error" ? "text-destructive border-destructive/30" : "text-muted-foreground border-border"}`}>
            {saveStatusText}
          </div>
        </div>

        <StepIndicator currentStep={step} />

        {saveError && <p className="text-sm text-destructive mb-4">{saveError}</p>}

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
            <StepStrategy
              missionGoals={data.mission_goals}
              productsServicesText={data.products_services_text}
              scanState={scanState}
              scanError={scanError}
              onMissionGoalsChange={(value) => patch({ mission_goals: value })}
              onProductsServicesChange={(value) => patch({ products_services_text: value })}
              onBack={handleStrategyBack}
              onNext={handleStrategyNext}
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
              onBack={handleTaskBack}
              onNext={handleTaskNext}
            />
          )}

          {step === 4 && (
            <StepConnectTools
              companyName={data.company_name}
              agentName={data.agent_name}
              missionGoals={data.mission_goals}
              productsServicesText={data.products_services_text}
              starterTask={data.starter_task}
              suggestionCount={data.agent_suggestions.length}
              launching={launching}
              launched={launchStarted}
              status={effectiveStatus}
              bootstrapStatus={bootstrapStatus}
              ready={provisioningComplete}
              polling={provisionPolling}
              lastCheckedAt={lastCheckedAt}
              error={launchError}
              onBack={() => changeStep(3)}
              onLaunch={handleLaunch}
              onRefresh={() => {
                void pollProvisionStatus();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
