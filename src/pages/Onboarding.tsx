import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PixelPortLogo from "@/components/PixelPortLogo";
import StepIndicator from "@/components/onboarding/StepIndicator";
import StepCompanyInfo from "@/components/onboarding/StepCompanyInfo";
import StepStrategy from "@/components/onboarding/StepStrategy";
import StepTaskSetup from "@/components/onboarding/StepTaskSetup";
import StepConnectTools, { type ProvisioningProgressPayload } from "@/components/onboarding/StepConnectTools";
import AgentPreviewPanel, { MobileAgentBar } from "@/components/onboarding/AgentPreviewPanel";
import { AvatarIllustration } from "@/components/onboarding/AvatarIllustrations";
import { LogOut, Target, Package, ListChecks, ShieldCheck } from "lucide-react";
import { getPostAuthRedirectPath } from "@/lib/dashboard-redirect";
import {
  AGENT_AVATAR_OPTIONS,
  APPROVAL_MODE_OPTIONS,
  AGENT_TONE_OPTIONS,
  TONE_PREVIEW_PHRASES,
  DEFAULT_APPROVAL_POLICY,
  MAX_ONBOARDING_GOALS,
  buildGoalMappedTasks,
  type ApprovalPolicyInput,
} from "@/lib/onboarding-presets";
import {
  TENANT_STATUS,
  isTenantProvisioningComplete,
  isTenantProvisioningInFlight,
} from "@/lib/tenant-status";

interface TenantStatusResponse {
  status?: string | null;
  bootstrap_status?: string | null;
  provisioning_progress?: ProvisioningProgressPayload | null;
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
  agent_tone: string;
  agent_avatar_id: string;
  goals: string[];
  products_services_text: string;
  starter_tasks: string[];
  preset_task_count: number;
  approval_policy: ApprovalPolicyInput;
  scan_results: Record<string, unknown> | null;
}

const DEFAULT_AGENT_NAME = "Chief";
const DEFAULT_AGENT_TONE = AGENT_TONE_OPTIONS[0].id;
const DEFAULT_AGENT_AVATAR_ID = AGENT_AVATAR_OPTIONS[0].id;
const MAX_STARTER_TASKS = 12;
const POLL_INTERVAL_MS = 5000;

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

function normalizeStringArray(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function toGoalsArray(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, MAX_ONBOARDING_GOALS);
}

function toMissionGoalsText(goals: string[]): string {
  return goals.map((goal) => goal.trim()).filter(Boolean).slice(0, MAX_ONBOARDING_GOALS).join("\n");
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

function buildFallbackTask(companyName: string, goals: string[]): string {
  const safeCompanyName = companyName.trim() || "the company";
  const safeGoal = goals[0]?.trim() || "the top marketing priorities";
  return `Create a focused 14-day execution plan for ${safeCompanyName} aligned to: ${safeGoal}.`;
}

function sanitizeStarterTasks(value: string[]): string[] {
  return value
    .map((task) => task.trim())
    .filter(Boolean)
    .slice(0, MAX_STARTER_TASKS);
}

function syncStarterTasksWithGoals(data: OnboardingFormData): OnboardingFormData {
  const presetTasks = buildGoalMappedTasks(data.goals, data.company_name).slice(0, MAX_STARTER_TASKS);
  const customTasks = data.starter_tasks.slice(data.preset_task_count);
  const nextTasks = [...presetTasks, ...customTasks].slice(0, MAX_STARTER_TASKS);

  if (nextTasks.length === 0) {
    return {
      ...data,
      starter_tasks: [buildFallbackTask(data.company_name, data.goals)],
      preset_task_count: 0,
    };
  }

  return {
    ...data,
    starter_tasks: nextTasks,
    preset_task_count: presetTasks.length,
  };
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

function readGoalsFromOnboarding(onboardingData: Record<string, unknown>): string[] {
  const flatGoals = normalizeStringArray(onboardingData.goals, MAX_ONBOARDING_GOALS);
  if (flatGoals.length > 0) {
    return flatGoals;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.strategy)) {
    const nestedGoals = normalizeStringArray(onboardingData.v2.strategy.goals, MAX_ONBOARDING_GOALS);
    if (nestedGoals.length > 0) {
      return nestedGoals;
    }

    const nestedMission = readString(onboardingData.v2.strategy.mission_goals).trim();
    if (nestedMission) {
      return toGoalsArray(nestedMission);
    }
  }

  const missionGoals = readString(onboardingData.mission_goals).trim() || readString(onboardingData.mission).trim();
  return toGoalsArray(missionGoals);
}

function readAgentToneFromOnboarding(onboardingData: Record<string, unknown>): string {
  const flatTone = readString(onboardingData.agent_tone).trim().toLowerCase();
  if (AGENT_TONE_OPTIONS.some((tone) => tone.id === flatTone)) {
    return flatTone;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.company)) {
    const nestedTone = readString(onboardingData.v2.company.tone).trim().toLowerCase();
    if (AGENT_TONE_OPTIONS.some((tone) => tone.id === nestedTone)) {
      return nestedTone;
    }
  }

  return DEFAULT_AGENT_TONE;
}

function readAgentAvatarFromOnboarding(onboardingData: Record<string, unknown>): string {
  const flatAvatar =
    readString(onboardingData.agent_avatar_id).trim() ||
    readString(onboardingData.agent_avatar_url).trim();
  if (AGENT_AVATAR_OPTIONS.some((avatar) => avatar.id === flatAvatar)) {
    return flatAvatar;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.company)) {
    const nestedAvatar = readString(onboardingData.v2.company.avatar_id).trim();
    if (AGENT_AVATAR_OPTIONS.some((avatar) => avatar.id === nestedAvatar)) {
      return nestedAvatar;
    }
  }

  return DEFAULT_AGENT_AVATAR_ID;
}

function productsFromOnboarding(onboardingData: Record<string, unknown>): string[] {
  const flatProducts = normalizeStringArray(onboardingData.products_services, 20);
  if (flatProducts.length > 0) {
    return flatProducts;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.strategy)) {
    const nestedProducts = normalizeStringArray(onboardingData.v2.strategy.products_services, 20);
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

function readStarterTasksFromOnboarding(onboardingData: Record<string, unknown>): string[] {
  const flatTasks = normalizeStringArray(onboardingData.starter_tasks, MAX_STARTER_TASKS);
  if (flatTasks.length > 0) {
    return flatTasks;
  }

  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.task)) {
    const nestedTasks = normalizeStringArray(onboardingData.v2.task.starter_tasks, MAX_STARTER_TASKS);
    if (nestedTasks.length > 0) {
      return nestedTasks;
    }

    const nestedStarterTask = readString(onboardingData.v2.task.starter_task).trim();
    if (nestedStarterTask) {
      return [nestedStarterTask];
    }
  }

  const legacyStarterTask = readString(onboardingData.starter_task).trim();
  return legacyStarterTask ? [legacyStarterTask] : [];
}

function readApprovalPolicyFromOnboarding(onboardingData: Record<string, unknown>): ApprovalPolicyInput {
  const fallback = { ...DEFAULT_APPROVAL_POLICY, guardrails: { ...DEFAULT_APPROVAL_POLICY.guardrails } };

  const candidates: unknown[] = [onboardingData.approval_policy];
  if (isRecord(onboardingData.v2) && isRecord(onboardingData.v2.task)) {
    candidates.push(onboardingData.v2.task.approval_policy);
  }

  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue;
    }

    const mode = readString(candidate.mode).toLowerCase();
    if (!APPROVAL_MODE_IDS.has(mode)) {
      continue;
    }

    const guardrails = isRecord(candidate.guardrails) ? candidate.guardrails : {};
    const next: ApprovalPolicyInput = {
      mode: mode as ApprovalPolicyInput["mode"],
      guardrails: {
        publish: typeof guardrails.publish === "boolean" ? guardrails.publish : fallback.guardrails.publish,
        paid_spend: typeof guardrails.paid_spend === "boolean" ? guardrails.paid_spend : fallback.guardrails.paid_spend,
        outbound_messages:
          typeof guardrails.outbound_messages === "boolean"
            ? guardrails.outbound_messages
            : fallback.guardrails.outbound_messages,
        major_strategy_changes:
          typeof guardrails.major_strategy_changes === "boolean"
            ? guardrails.major_strategy_changes
            : fallback.guardrails.major_strategy_changes,
      },
    };

    return next;
  }

  return fallback;
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
  return readGoalsFromOnboarding(onboardingData).length > 0;
}

function isTaskStepComplete(onboardingData: Record<string, unknown>): boolean {
  return readStarterTasksFromOnboarding(onboardingData).length > 0;
}

function hydrateStarterTasks(goals: string[], companyName: string, starterTasks: string[]): { tasks: string[]; presetTaskCount: number } {
  const presetTasks = buildGoalMappedTasks(goals, companyName).slice(0, MAX_STARTER_TASKS);
  const cleanStarterTasks = sanitizeStarterTasks(starterTasks);

  if (cleanStarterTasks.length === 0) {
    if (presetTasks.length > 0) {
      return {
        tasks: presetTasks,
        presetTaskCount: presetTasks.length,
      };
    }

    return {
      tasks: [buildFallbackTask(companyName, goals)],
      presetTaskCount: 0,
    };
  }

  const minimumPresetCount = Math.min(presetTasks.length, cleanStarterTasks.length);
  const padded = [...cleanStarterTasks];
  if (presetTasks.length > padded.length) {
    padded.push(...presetTasks.slice(padded.length));
  }

  return {
    tasks: padded.slice(0, MAX_STARTER_TASKS),
    presetTaskCount: minimumPresetCount,
  };
}

function getInitialFormState(): OnboardingFormData {
  return {
    company_name: "",
    company_url: "",
    agent_name: DEFAULT_AGENT_NAME,
    agent_tone: DEFAULT_AGENT_TONE,
    agent_avatar_id: DEFAULT_AGENT_AVATAR_ID,
    goals: [],
    products_services_text: "",
    starter_tasks: [buildFallbackTask("", [])],
    preset_task_count: 0,
    approval_policy: { ...DEFAULT_APPROVAL_POLICY, guardrails: { ...DEFAULT_APPROVAL_POLICY.guardrails } },
    scan_results: null,
  };
}

function buildFormStateFromTenant(tenantName: string, onboardingData: Record<string, unknown>): OnboardingFormData {
  const companyName = readString(onboardingData.company_name).trim() || tenantName;
  const goals = readGoalsFromOnboarding(onboardingData);
  const starterTasks = readStarterTasksFromOnboarding(onboardingData);
  const hydratedTasks = hydrateStarterTasks(goals, companyName, starterTasks);

  return {
    company_name: companyName,
    company_url: readString(onboardingData.company_url),
    agent_name: readString(onboardingData.agent_name).trim() || DEFAULT_AGENT_NAME,
    agent_tone: readAgentToneFromOnboarding(onboardingData),
    agent_avatar_id: readAgentAvatarFromOnboarding(onboardingData),
    goals,
    products_services_text: productsTextFromArray(productsFromOnboarding(onboardingData)),
    starter_tasks: hydratedTasks.tasks,
    preset_task_count: hydratedTasks.presetTaskCount,
    approval_policy: readApprovalPolicyFromOnboarding(onboardingData),
    scan_results: scanResultsFromOnboarding(onboardingData),
  };
}

const APPROVAL_MODE_IDS = new Set(APPROVAL_MODE_OPTIONS.map((mode) => mode.id));

const Onboarding = () => {
  const {
    user,
    session,
    tenant,
    loading: authLoading,
    tenantLoading,
    refreshTenant,
    signOut,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
  const [goalError, setGoalError] = useState("");

  const [launching, setLaunching] = useState(false);
  const [launchStarted, setLaunchStarted] = useState(false);
  const [launchError, setLaunchError] = useState("");

  const [provisionStatus, setProvisionStatus] = useState<string | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null);
  const [provisionProgress, setProvisionProgress] = useState<ProvisioningProgressPayload | null>(null);
  const [provisionPolling, setProvisionPolling] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const hydratedTenantIdRef = useRef<string | null>(null);
  const launchCompletionMarkedRef = useRef(false);
  const redirectPath = getPostAuthRedirectPath(location.state);

  const effectiveStatus = provisionStatus ?? tenant?.status ?? null;
  const provisioningComplete = isTenantProvisioningComplete(effectiveStatus);
  const tenantOnboardingData = isRecord(tenant?.onboarding_data) ? tenant.onboarding_data : null;
  const scanSuggestions = extractProductsFromScan(data.scan_results);

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
        let patchProducts: string[] | null = null;

        setData((current) => {
          if (current.products_services_text.trim().length > 0 || scannedProducts.length === 0) {
            return {
              ...current,
              scan_results: scanResults,
            };
          }

          patchProducts = scannedProducts;
          return {
            ...current,
            scan_results: scanResults,
            products_services_text: productsTextFromArray(scannedProducts),
          };
        });

        const patchPayload: Record<string, unknown> = {
          scan_results: scanResults,
        };

        if (patchProducts && patchProducts.length > 0) {
          patchPayload.products_services = patchProducts;
        }

        await saveOnboardingPatch(patchPayload, { silent: true });
        setScanState("done");
      } catch (error) {
        setScanState("failed");
        setScanError(error instanceof Error ? error.message : "Website scan failed.");
      }
    },
    [saveOnboardingPatch, session?.access_token]
  );

  const buildStrategyPatch = useCallback((formData: OnboardingFormData) => {
    const safeGoals = formData.goals.slice(0, MAX_ONBOARDING_GOALS);
    const missionGoals = toMissionGoalsText(safeGoals);

    return {
      mission_goals: missionGoals,
      mission: missionGoals,
      goals: safeGoals,
      products_services: toProductsArray(formData.products_services_text),
      scan_results: formData.scan_results,
    };
  }, []);

  const buildTaskPatch = useCallback((formData: OnboardingFormData) => {
    const starterTasks = sanitizeStarterTasks(formData.starter_tasks);
    const safeTasks = starterTasks.length > 0 ? starterTasks : [buildFallbackTask(formData.company_name, formData.goals)];

    return {
      starter_tasks: safeTasks,
      starter_task: safeTasks[0],
      approval_policy: formData.approval_policy,
    };
  }, []);

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
      setProvisionProgress(payload.provisioning_progress ?? null);
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
    const agentTone = AGENT_TONE_OPTIONS.some((tone) => tone.id === data.agent_tone)
      ? data.agent_tone
      : DEFAULT_AGENT_TONE;
    const agentAvatarId = AGENT_AVATAR_OPTIONS.some((avatar) => avatar.id === data.agent_avatar_id)
      ? data.agent_avatar_id
      : DEFAULT_AGENT_AVATAR_ID;

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
            agent_tone: agentTone,
            agent_avatar_id: agentAvatarId,
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
          agent_tone: agentTone,
          agent_avatar_id: agentAvatarId,
        },
        { refreshTenantAfter: false }
      );

      if (!saved) {
        return;
      }

      setData((current) =>
        syncStarterTasksWithGoals({
          ...current,
          company_name: companyName,
          company_url: companyUrl,
          agent_name: agentName,
          agent_tone: agentTone,
          agent_avatar_id: agentAvatarId,
        })
      );

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
    const synced = syncStarterTasksWithGoals(data);
    setData(synced);
    const saved = await saveOnboardingPatch(buildStrategyPatch(synced));
    if (saved) {
      changeStep(3);
    }
  };

  const handleStrategyBack = async () => {
    const synced = syncStarterTasksWithGoals(data);
    setData(synced);
    await saveOnboardingPatch(buildStrategyPatch(synced));
    changeStep(1);
  };

  const handleTaskNext = async () => {
    const saved = await saveOnboardingPatch(buildTaskPatch(data));
    if (saved) {
      changeStep(4);
    }
  };

  const handleTaskBack = async () => {
    await saveOnboardingPatch(buildTaskPatch(data));
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

    if (!isTaskStepComplete(onboardingData)) {
      setStep(3);
      return;
    }

    setStep(4);
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
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[420px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, hsla(38,60%,58%,0.09) 0%, transparent 72%)" }}
      />

      {/* ── Top Header Bar ── */}
      <header className="shrink-0 grid grid-cols-[auto_1fr_auto] items-center px-5 sm:px-8 py-3 z-20">
        <Link to="/" className="flex items-center gap-2 py-1">
          <PixelPortLogo className="h-6 w-6" />
          <span className="text-sm font-bold text-foreground tracking-tight">PixelPort</span>
        </Link>
        <div className="flex justify-center">
          <StepIndicator currentStep={step} onStepClick={(target) => { if (target < step) changeStep(target); }} />
        </div>
        <div className="flex justify-end">
          {saveStatusText && (
            <span className={`text-[11px] font-mono ${saveState === "error" ? "text-destructive" : "text-muted-foreground/40"}`}>
              {saveStatusText}
            </span>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">

      {/* ── STEP 4: "Awakening Ceremony" — the showtime screen ── */}
      {step === 4 ? (
      <div className="w-full max-w-[800px] flex flex-col items-center relative z-10 -mt-8">
        {/* ── Hero: Avatar + Identity (OUTSIDE the card) ── */}
        <div className="flex flex-col items-center text-center relative mb-5">
          {/* Single ambient glow */}
          <div
            className="absolute w-[260px] h-[260px] rounded-full pointer-events-none animate-ambient-pulse"
            style={{
              background: `radial-gradient(circle, ${(AGENT_AVATAR_OPTIONS.find(a => a.id === data.agent_avatar_id) ?? AGENT_AVATAR_OPTIONS[0]).glowColor}, transparent 70%)`,
            }}
          />
          <div className="relative z-10 animate-avatar-appear" key={data.agent_avatar_id}>
            <AvatarIllustration
              id={(AGENT_AVATAR_OPTIONS.find(a => a.id === data.agent_avatar_id) ?? AGENT_AVATAR_OPTIONS[0]).svgId}
              size={120}
              glowing
            />
          </div>
          <h2 className="relative z-10 mt-4 text-3xl font-black tracking-tight text-foreground">
            {data.agent_name || "Chief"}
          </h2>
          <p className="relative z-10 mt-1.5 text-xs font-mono uppercase tracking-[0.25em] text-primary/70">
            {provisioningComplete
              ? "AI Chief of Staff — Ready"
              : launchStarted
              ? "Deploying..."
              : "AI Chief of Staff"}
          </p>
          <p className="relative z-10 mt-1 text-sm text-muted-foreground">
            {data.company_name} · {AGENT_TONE_OPTIONS.find(t => t.id === data.agent_tone)?.label ?? "Strategic"}
          </p>
        </div>

        {/* ── Card: Summary + Activate (INSIDE the card) ── */}
        <div
          className="w-full rounded-2xl border bg-card overflow-hidden"
          style={{ borderColor: "rgba(212,168,83,0.15)" }}
        >
          {/* Config Summary (pre-launch) — spec-sheet rows */}
          {!launchStarted && (
            <div className="px-6 sm:px-8 py-5 animate-section-in">
              <div className="divide-y divide-border/15">
                {/* Goals */}
                <div className="flex gap-3 py-3.5 first:pt-0">
                  <Target className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-[0.08em] mb-1.5">Goals</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {data.goals.map((goal, i) => (
                        <span key={goal} className="text-sm text-foreground/80">
                          {goal}{i < data.goals.length - 1 && <span className="text-muted-foreground/30 ml-2">·</span>}
                        </span>
                      ))}
                      {data.goals.length === 0 && <span className="text-sm text-muted-foreground/40">None set</span>}
                    </div>
                  </div>
                </div>

                {/* Products */}
                <div className="flex gap-3 py-3.5">
                  <Package className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-[0.08em] mb-1.5">Products</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {data.products_services_text.trim()
                        ? data.products_services_text.split("\n").filter(Boolean).slice(0, 5).join(", ") +
                          (data.products_services_text.split("\n").filter(Boolean).length > 5 ? "..." : "")
                        : "None set"}
                    </p>
                  </div>
                </div>

                {/* Approval */}
                <div className="flex gap-3 py-3.5">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-[0.08em] mb-1.5">Approval</p>
                    <p className="text-sm text-foreground/80 capitalize">{data.approval_policy.mode}</p>
                  </div>
                </div>

                {/* Tasks */}
                <div className="flex gap-3 py-3.5 last:pb-0">
                  <ListChecks className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-[0.08em] mb-2">Starter Tasks</p>
                    <div className="space-y-1.5">
                      {data.starter_tasks.filter(Boolean).map((task, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="shrink-0 mt-0.5 text-xs font-mono text-primary/50">{i + 1}.</span>
                          <p className="text-sm text-foreground/70 leading-snug">{task}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Activate / Progress Section */}
          <div className={`${!launchStarted ? "border-t border-border/20" : ""} px-6 sm:px-8 py-6`}>
          <StepConnectTools
            companyName={data.company_name}
            agentName={data.agent_name}
            goals={data.goals}
            productsServicesText={data.products_services_text}
            starterTasks={data.starter_tasks}
            approvalPolicy={data.approval_policy}
            launching={launching}
            launched={launchStarted}
            status={effectiveStatus}
            bootstrapStatus={bootstrapStatus}
            progress={provisionProgress}
            ready={provisioningComplete}
            polling={provisionPolling}
            lastCheckedAt={lastCheckedAt}
            error={launchError}
            onBack={() => changeStep(3)}
            onLaunch={handleLaunch}
            onRefresh={() => { void pollProvisionStatus(); }}
          />
        </div>
      </div>
      </div>
      ) : (

      /* ── Two-panel layout for steps 1-3 ── */
      <div
        className="w-full max-w-[1080px] lg:max-h-[calc(100vh-120px)] rounded-2xl border bg-card relative z-10 p-0 overflow-hidden grid lg:grid-cols-[340px_1fr]"
        style={{ borderColor: "rgba(212,168,83,0.15)" }}
      >
        {/* ── Left Panel: Persistent Agent Preview ── */}
        <AgentPreviewPanel
          step={step}
          agentName={data.agent_name}
          agentTone={(data.agent_tone || "strategic") as import("@/lib/onboarding-presets").AgentToneId}
          agentAvatarId={data.agent_avatar_id}
          companyName={data.company_name}
          companyUrl={data.company_url}
          goals={data.goals}
          starterTasks={data.starter_tasks}
          approvalMode={data.approval_policy.mode}
          launched={launchStarted}
          provisioningReady={provisioningComplete}
        />

        {/* ── Right Panel: Active Step Form ── */}
        <div className="relative border-t lg:border-t-0 lg:border-l border-border/30 bg-[hsl(240_6%_7%)] p-6 sm:p-8 overflow-y-auto min-h-0">
          {/* Mobile agent bar */}
          <MobileAgentBar
            step={step}
            agentName={data.agent_name}
            agentTone={(data.agent_tone || "strategic") as import("@/lib/onboarding-presets").AgentToneId}
            agentAvatarId={data.agent_avatar_id}
            companyName={data.company_name}
            goals={data.goals}
          />

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
              goals={data.goals}
              productsServicesText={data.products_services_text}
              scanState={scanState}
              scanError={scanError}
              scanSuggestions={scanSuggestions}
              goalError={goalError}
              onToggleGoal={(goal) => {
                const exists = data.goals.includes(goal);
                if (!exists && data.goals.length >= MAX_ONBOARDING_GOALS) {
                  setGoalError(`You can select up to ${MAX_ONBOARDING_GOALS} goals.`);
                  return;
                }

                setGoalError("");
                const nextGoals = exists ? data.goals.filter((entry) => entry !== goal) : [...data.goals, goal];
                setData((current) => syncStarterTasksWithGoals({ ...current, goals: nextGoals }));
              }}
              onAddCustomGoal={(goal) => {
                if (data.goals.length >= MAX_ONBOARDING_GOALS) {
                  setGoalError(`You can select up to ${MAX_ONBOARDING_GOALS} goals.`);
                  return;
                }

                const normalized = goal.trim();
                if (!normalized) {
                  return;
                }

                if (data.goals.includes(normalized)) {
                  return;
                }

                setGoalError("");
                setData((current) => syncStarterTasksWithGoals({ ...current, goals: [...current.goals, normalized] }));
              }}
              onRemoveGoal={(goal) => {
                setGoalError("");
                setData((current) =>
                  syncStarterTasksWithGoals({
                    ...current,
                    goals: current.goals.filter((entry) => entry !== goal),
                  })
                );
              }}
              onProductsServicesChange={(value) => patch({ products_services_text: value })}
              onApplyScanSuggestions={() => {
                if (scanSuggestions.length === 0) {
                  return;
                }

                setData((current) => {
                  const existing = toProductsArray(current.products_services_text);
                  const merged = [...new Set([...existing, ...scanSuggestions])].slice(0, 20);
                  return {
                    ...current,
                    products_services_text: productsTextFromArray(merged),
                  };
                });
              }}
              onRetryScan={() => {
                if (!data.company_url.trim()) {
                  setScanError("Add a company website URL in Company step before retrying scan.");
                  setScanState("failed");
                  return;
                }

                void runWebsiteScan(data.company_url);
              }}
              onBack={handleStrategyBack}
              onNext={handleStrategyNext}
            />
          )}

          {step === 3 && (
            <StepTaskSetup
              companyName={data.company_name}
              goals={data.goals}
              starterTasks={data.starter_tasks}
              presetTaskCount={data.preset_task_count}
              approvalPolicy={data.approval_policy}
              onTaskChange={(index, value) => {
                setData((current) => ({
                  ...current,
                  starter_tasks: current.starter_tasks.map((task, taskIndex) =>
                    taskIndex === index ? value : task
                  ),
                }));
              }}
              onAddCustomTask={() => {
                setData((current) => ({
                  ...current,
                  starter_tasks: [...current.starter_tasks, ""].slice(0, MAX_STARTER_TASKS),
                }));
              }}
              onRemoveCustomTask={(index) => {
                setData((current) => {
                  if (index < current.preset_task_count) {
                    return current;
                  }

                  const nextTasks = current.starter_tasks.filter((_, rowIndex) => rowIndex !== index);
                  return {
                    ...current,
                    starter_tasks: nextTasks.length > 0 ? nextTasks : [buildFallbackTask(current.company_name, current.goals)],
                  };
                });
              }}
              onApprovalModeChange={(mode) => {
                setData((current) => ({
                  ...current,
                  approval_policy: {
                    ...current.approval_policy,
                    mode,
                  },
                }));
              }}
              onGuardrailChange={(key, value) => {
                setData((current) => ({
                  ...current,
                  approval_policy: {
                    ...current.approval_policy,
                    guardrails: {
                      ...current.approval_policy.guardrails,
                      [key]: value,
                    },
                  },
                }));
              }}
              onBack={handleTaskBack}
              onNext={handleTaskNext}
            />
          )}

          {/* Step 4 is rendered in centered layout above, not in the two-panel grid */}
          </div>
        </div>
      </div>
      )}
      </div>

      {/* ── Sign out — slim bottom bar ── */}
      <div className="shrink-0 flex items-center px-5 sm:px-8 py-2">
        <button
          type="button"
          onClick={async () => { await signOut(); navigate("/login"); }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
