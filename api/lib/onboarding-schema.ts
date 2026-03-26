import { z } from "zod";

export const ONBOARDING_SCHEMA_VERSION = 2;
export const ONBOARDING_RENDER_VERSION = 1;

const MAX_GOALS = 8;
const MAX_PRODUCTS = 20;

type JsonRecord = Record<string, unknown>;

const agentSuggestionSchema = z
  .object({
    id: z.string().max(120).optional(),
    role: z.string().max(120).optional(),
    name: z.string().max(120).optional(),
    focus: z.string().max(400).optional(),
  })
  .passthrough();

const nestedPatchSchema = z
  .object({
    company: z
      .object({
        name: z.string().max(100).optional(),
        website: z.union([z.string().max(255), z.null()]).optional(),
        chief_name: z.string().max(60).optional(),
      })
      .partial()
      .optional(),
    strategy: z
      .object({
        mission_goals: z.string().max(500).optional(),
        goals: z.array(z.string().max(200)).max(MAX_GOALS).optional(),
        products_services: z.array(z.string().max(160)).max(MAX_PRODUCTS).optional(),
        scan_results: z.record(z.unknown()).nullable().optional(),
      })
      .partial()
      .optional(),
    task: z
      .object({
        starter_task: z.string().max(500).optional(),
        agent_suggestions: z.array(agentSuggestionSchema).max(20).optional(),
      })
      .partial()
      .optional(),
    launch: z
      .object({
        started_at: z.string().max(64).nullable().optional(),
        completed_at: z.string().max(64).nullable().optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

const onboardingPatchSchema = z
  .object({
    schema_version: z.number().int().optional(),
    render_version: z.number().int().optional(),
    company_name: z.string().max(100).optional(),
    company_url: z.union([z.string().max(255), z.null()]).optional(),
    mission_goals: z.string().max(500).optional(),
    mission: z.string().max(500).optional(),
    goals: z.array(z.string().max(200)).max(MAX_GOALS).optional(),
    agent_name: z.string().max(60).optional(),
    starter_task: z.string().max(500).optional(),
    agent_suggestions: z.array(agentSuggestionSchema).max(20).optional(),
    products_services: z.array(z.string().max(160)).max(MAX_PRODUCTS).optional(),
    scan_results: z.record(z.unknown()).nullable().optional(),
    launch_started_at: z.string().max(64).nullable().optional(),
    launch_completed_at: z.string().max(64).nullable().optional(),
    v2: nestedPatchSchema.optional(),
  })
  .passthrough();

export interface AgentSuggestion {
  id: string;
  role: string;
  name: string;
  focus: string;
}

export interface OnboardingState {
  companyName: string;
  companyUrl: string | null;
  missionGoals: string;
  goals: string[];
  agentName: string;
  starterTask: string;
  agentSuggestions: AgentSuggestion[];
  productsServices: string[];
  scanResults: JsonRecord | null;
  launchStartedAt: string | null;
  launchCompletedAt: string | null;
}

type BuildSuccess = {
  ok: true;
  state: OnboardingState;
  onboardingData: JsonRecord;
};

type BuildFailure = {
  ok: false;
  error: string;
};

type BuildResult = BuildSuccess | BuildFailure;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  const stringValue = readString(value);
  return stringValue.length > 0 ? stringValue : null;
}

function normalizeStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.slice(0, maxItems);
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

  return tokens.slice(0, MAX_GOALS);
}

function buildStarterTask(companyName: string, missionGoals: string): string {
  const safeCompanyName = companyName.trim() || "the company";
  const safeGoal = missionGoals.trim() || "the top marketing priorities";
  return `Create a focused 14-day plan for ${safeCompanyName} aligned to: ${safeGoal}.`;
}

function createSuggestionId(): string {
  return `agent-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultAgentSuggestions(agentName: string): AgentSuggestion[] {
  const baseName = agentName.trim() || "Luna";
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

function normalizeAgentSuggestions(value: unknown, fallbackAgentName: string): AgentSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter(isRecord)
    .map((item) => ({
      id: readString(item.id) || createSuggestionId(),
      role: readString(item.role),
      name: readString(item.name),
      focus: readString(item.focus),
    }))
    .filter((item) => item.role || item.name || item.focus);

  return normalized.length > 0 ? normalized : defaultAgentSuggestions(fallbackAgentName);
}

function extractProductsFromScan(scanResults: JsonRecord | null): string[] {
  if (!scanResults) {
    return [];
  }

  const keyProducts = normalizeStringList(scanResults.key_products, MAX_PRODUCTS);
  if (keyProducts.length > 0) {
    return keyProducts;
  }

  return normalizeStringList(scanResults.products_services, MAX_PRODUCTS);
}

function extractStateFromOnboardingData(onboardingData: JsonRecord): OnboardingState {
  const nested = isRecord(onboardingData.v2) ? onboardingData.v2 : {};
  const nestedCompany = isRecord(nested.company) ? nested.company : {};
  const nestedStrategy = isRecord(nested.strategy) ? nested.strategy : {};
  const nestedTask = isRecord(nested.task) ? nested.task : {};
  const nestedLaunch = isRecord(nested.launch) ? nested.launch : {};

  const companyName = readString(onboardingData.company_name) || readString(nestedCompany.name);
  const companyUrl =
    readNullableString(onboardingData.company_url) ?? readNullableString(nestedCompany.website) ?? null;
  const missionGoals =
    readString(onboardingData.mission_goals) || readString(onboardingData.mission) || readString(nestedStrategy.mission_goals);
  const goals = normalizeStringList(onboardingData.goals, MAX_GOALS);
  const nestedGoals = normalizeStringList(nestedStrategy.goals, MAX_GOALS);
  const resolvedGoals = goals.length > 0 ? goals : nestedGoals.length > 0 ? nestedGoals : toGoalsArray(missionGoals);
  const agentName = readString(onboardingData.agent_name) || readString(nestedCompany.chief_name) || "Luna";
  const starterTask =
    readString(onboardingData.starter_task) || readString(nestedTask.starter_task) || buildStarterTask(companyName, missionGoals);

  const flatSuggestions = normalizeAgentSuggestions(onboardingData.agent_suggestions, agentName);
  const nestedSuggestions = normalizeAgentSuggestions(nestedTask.agent_suggestions, agentName);
  const agentSuggestions =
    flatSuggestions.length > 0 ? flatSuggestions : nestedSuggestions.length > 0 ? nestedSuggestions : defaultAgentSuggestions(agentName);

  const flatProducts = normalizeStringList(onboardingData.products_services, MAX_PRODUCTS);
  const nestedProducts = normalizeStringList(nestedStrategy.products_services, MAX_PRODUCTS);
  const scanResults =
    (isRecord(onboardingData.scan_results) ? onboardingData.scan_results : null) ??
    (isRecord(nestedStrategy.scan_results) ? nestedStrategy.scan_results : null);
  const scanProducts = extractProductsFromScan(scanResults);
  const productsServices =
    flatProducts.length > 0
      ? flatProducts
      : nestedProducts.length > 0
      ? nestedProducts
      : scanProducts;

  const launchStartedAt =
    readNullableString(onboardingData.launch_started_at) ?? readNullableString(nestedLaunch.started_at) ?? null;
  const launchCompletedAt =
    readNullableString(onboardingData.launch_completed_at) ?? readNullableString(nestedLaunch.completed_at) ?? null;

  return {
    companyName,
    companyUrl,
    missionGoals,
    goals: resolvedGoals,
    agentName,
    starterTask,
    agentSuggestions,
    productsServices,
    scanResults,
    launchStartedAt,
    launchCompletedAt,
  };
}

function applyPatch(state: OnboardingState, rawPatch: z.infer<typeof onboardingPatchSchema>): OnboardingState {
  const next = { ...state };

  const nested = rawPatch.v2 ?? {};
  const nestedCompany = nested.company ?? {};
  const nestedStrategy = nested.strategy ?? {};
  const nestedTask = nested.task ?? {};
  const nestedLaunch = nested.launch ?? {};

  const companyName = readString(nestedCompany.name ?? rawPatch.company_name);
  if (companyName) {
    next.companyName = companyName;
  }

  const companyUrl = readNullableString(nestedCompany.website ?? rawPatch.company_url);
  if (companyUrl !== null || rawPatch.company_url === null || nestedCompany.website === null) {
    next.companyUrl = companyUrl;
  }

  const missionGoalsCandidate = readString(nestedStrategy.mission_goals ?? rawPatch.mission_goals ?? rawPatch.mission);
  if (missionGoalsCandidate || rawPatch.mission_goals === "" || rawPatch.mission === "") {
    next.missionGoals = missionGoalsCandidate;
  }

  const goals = normalizeStringList(nestedStrategy.goals ?? rawPatch.goals, MAX_GOALS);
  if (goals.length > 0 || Array.isArray(rawPatch.goals) || Array.isArray(nestedStrategy.goals)) {
    next.goals = goals;
  } else if (missionGoalsCandidate) {
    next.goals = toGoalsArray(next.missionGoals);
  }

  const agentNameCandidate = readString(nestedCompany.chief_name ?? rawPatch.agent_name);
  if (agentNameCandidate) {
    next.agentName = agentNameCandidate;
  }

  const starterTaskCandidate = readString(nestedTask.starter_task ?? rawPatch.starter_task);
  if (starterTaskCandidate) {
    next.starterTask = starterTaskCandidate;
  }

  const patchSuggestions = normalizeAgentSuggestions(nestedTask.agent_suggestions ?? rawPatch.agent_suggestions, next.agentName);
  if (patchSuggestions.length > 0 || Array.isArray(rawPatch.agent_suggestions) || Array.isArray(nestedTask.agent_suggestions)) {
    next.agentSuggestions = patchSuggestions;
  }

  const scanResultsCandidate =
    (isRecord(nestedStrategy.scan_results) ? nestedStrategy.scan_results : null) ??
    (isRecord(rawPatch.scan_results) ? rawPatch.scan_results : null);
  if (
    scanResultsCandidate !== null ||
    rawPatch.scan_results === null ||
    nestedStrategy.scan_results === null
  ) {
    next.scanResults = scanResultsCandidate;
  }

  const products = normalizeStringList(nestedStrategy.products_services ?? rawPatch.products_services, MAX_PRODUCTS);
  if (products.length > 0 || Array.isArray(rawPatch.products_services) || Array.isArray(nestedStrategy.products_services)) {
    next.productsServices = products;
  } else if (next.productsServices.length === 0) {
    next.productsServices = extractProductsFromScan(next.scanResults);
  }

  const launchStartedCandidate = readNullableString(nestedLaunch.started_at ?? rawPatch.launch_started_at);
  if (
    launchStartedCandidate !== null ||
    rawPatch.launch_started_at === null ||
    nestedLaunch.started_at === null
  ) {
    next.launchStartedAt = launchStartedCandidate;
  }

  const launchCompletedCandidate = readNullableString(nestedLaunch.completed_at ?? rawPatch.launch_completed_at);
  if (
    launchCompletedCandidate !== null ||
    rawPatch.launch_completed_at === null ||
    nestedLaunch.completed_at === null
  ) {
    next.launchCompletedAt = launchCompletedCandidate;
  }

  if (!next.goals.length) {
    next.goals = toGoalsArray(next.missionGoals);
  }

  if (!next.starterTask) {
    next.starterTask = buildStarterTask(next.companyName, next.missionGoals);
  }

  if (!next.agentSuggestions.length) {
    next.agentSuggestions = defaultAgentSuggestions(next.agentName);
  }

  return next;
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "body";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function buildOnboardingData(existingRaw: unknown, patchRaw: unknown): BuildResult {
  const parsedPatch = onboardingPatchSchema.safeParse(patchRaw);
  if (!parsedPatch.success) {
    return {
      ok: false,
      error: formatZodError(parsedPatch.error),
    };
  }

  const existing = isRecord(existingRaw) ? existingRaw : {};
  const state = applyPatch(extractStateFromOnboardingData(existing), parsedPatch.data);

  const canonical: JsonRecord = {
    ...existing,
    schema_version: ONBOARDING_SCHEMA_VERSION,
    render_version: ONBOARDING_RENDER_VERSION,
    v2: {
      company: {
        name: state.companyName,
        website: state.companyUrl,
        chief_name: state.agentName,
      },
      strategy: {
        mission_goals: state.missionGoals,
        goals: state.goals,
        products_services: state.productsServices,
        scan_results: state.scanResults,
      },
      task: {
        starter_task: state.starterTask,
        agent_suggestions: state.agentSuggestions,
      },
      launch: {
        started_at: state.launchStartedAt,
        completed_at: state.launchCompletedAt,
      },
    },
    company_name: state.companyName,
    company_url: state.companyUrl,
    mission_goals: state.missionGoals,
    mission: state.missionGoals || null,
    goals: state.goals,
    agent_name: state.agentName,
    starter_task: state.starterTask,
    agent_suggestions: state.agentSuggestions,
    products_services: state.productsServices,
    scan_results: state.scanResults,
    launch_started_at: state.launchStartedAt,
    launch_completed_at: state.launchCompletedAt,
  };

  return {
    ok: true,
    state,
    onboardingData: canonical,
  };
}
