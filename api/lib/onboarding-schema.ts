import { z } from "zod";

export const ONBOARDING_SCHEMA_VERSION = 2;
export const ONBOARDING_RENDER_VERSION = 1;

const MAX_GOALS = 3;
const MAX_PRODUCTS = 20;
const MAX_STARTER_TASKS = 12;

const AGENT_TONE_VALUES = ["strategic", "professional", "concise", "warm", "analytical", "bold"] as const;
const APPROVAL_MODE_VALUES = ["strict", "balanced", "autonomous"] as const;

const DEFAULT_AGENT_NAME = "Chief";
const DEFAULT_AGENT_TONE = AGENT_TONE_VALUES[0];
const DEFAULT_AGENT_AVATAR_ID = "amber-command";

type JsonRecord = Record<string, unknown>;

export type AgentTone = (typeof AGENT_TONE_VALUES)[number];
export type ApprovalMode = (typeof APPROVAL_MODE_VALUES)[number];

export interface ApprovalPolicy {
  mode: ApprovalMode;
  guardrails: {
    publish: boolean;
    paid_spend: boolean;
    outbound_messages: boolean;
    major_strategy_changes: boolean;
  };
}

const approvalPolicySchema = z.object({
  mode: z.enum(APPROVAL_MODE_VALUES),
  guardrails: z.object({
    publish: z.boolean(),
    paid_spend: z.boolean(),
    outbound_messages: z.boolean(),
    major_strategy_changes: z.boolean(),
  }),
});

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
        tone: z.enum(AGENT_TONE_VALUES).optional(),
        avatar_id: z.string().max(80).optional(),
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
        starter_tasks: z.array(z.string().max(320)).max(MAX_STARTER_TASKS).optional(),
        approval_policy: approvalPolicySchema.optional(),
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
    agent_tone: z.enum(AGENT_TONE_VALUES).optional(),
    agent_avatar_id: z.string().max(80).optional(),
    agent_avatar_url: z.string().max(80).optional(),
    starter_task: z.string().max(500).optional(),
    starter_tasks: z.array(z.string().max(320)).max(MAX_STARTER_TASKS).optional(),
    approval_policy: approvalPolicySchema.optional(),
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
  agentTone: AgentTone;
  agentAvatarId: string;
  starterTask: string;
  starterTasks: string[];
  approvalPolicy: ApprovalPolicy;
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

function normalizeTone(value: unknown): AgentTone | null {
  const candidate = readString(value).toLowerCase();
  if (!candidate) {
    return null;
  }

  return AGENT_TONE_VALUES.includes(candidate as AgentTone)
    ? (candidate as AgentTone)
    : null;
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

function toMissionGoalsText(goals: string[]): string {
  return goals.map((goal) => goal.trim()).filter(Boolean).slice(0, MAX_GOALS).join("\n");
}

function buildStarterTask(companyName: string, firstGoal: string): string {
  const safeCompanyName = companyName.trim() || "the company";
  const safeGoal = firstGoal.trim() || "the top marketing priorities";
  return `Create a focused 14-day plan for ${safeCompanyName} aligned to: ${safeGoal}.`;
}

function createSuggestionId(): string {
  return `agent-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAgentSuggestions(value: unknown): AgentSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      id: readString(item.id) || createSuggestionId(),
      role: readString(item.role),
      name: readString(item.name),
      focus: readString(item.focus),
    }))
    .filter((item) => item.role || item.name || item.focus)
    .slice(0, 20);
}

function defaultApprovalPolicy(): ApprovalPolicy {
  return {
    mode: "balanced",
    guardrails: {
      publish: true,
      paid_spend: true,
      outbound_messages: true,
      major_strategy_changes: true,
    },
  };
}

function normalizeApprovalPolicy(value: unknown): ApprovalPolicy | null {
  const parsed = approvalPolicySchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
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

function resolveStarterTasks(params: {
  companyName: string;
  goals: string[];
  missionGoals: string;
  flatStarterTasks: string[];
  nestedStarterTasks: string[];
  legacyStarterTask: string;
}): { starterTasks: string[]; starterTask: string } {
  const starterTasks =
    params.flatStarterTasks.length > 0
      ? params.flatStarterTasks
      : params.nestedStarterTasks.length > 0
      ? params.nestedStarterTasks
      : params.legacyStarterTask
      ? [params.legacyStarterTask]
      : [];

  const safeStarterTasks = starterTasks.slice(0, MAX_STARTER_TASKS);

  if (safeStarterTasks.length === 0) {
    safeStarterTasks.push(
      buildStarterTask(params.companyName, params.goals[0] || params.missionGoals)
    );
  }

  return {
    starterTasks: safeStarterTasks,
    starterTask: safeStarterTasks[0],
  };
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

  const missionGoalsCandidate =
    readString(onboardingData.mission_goals) ||
    readString(onboardingData.mission) ||
    readString(nestedStrategy.mission_goals);
  const flatGoals = normalizeStringList(onboardingData.goals, MAX_GOALS);
  const nestedGoals = normalizeStringList(nestedStrategy.goals, MAX_GOALS);
  const resolvedGoals =
    flatGoals.length > 0 ? flatGoals : nestedGoals.length > 0 ? nestedGoals : toGoalsArray(missionGoalsCandidate);
  const missionGoals = missionGoalsCandidate || toMissionGoalsText(resolvedGoals);

  const agentName = readString(onboardingData.agent_name) || readString(nestedCompany.chief_name) || DEFAULT_AGENT_NAME;
  const agentTone =
    normalizeTone(onboardingData.agent_tone) ||
    normalizeTone(nestedCompany.tone) ||
    DEFAULT_AGENT_TONE;
  const agentAvatarId =
    readString(onboardingData.agent_avatar_id) ||
    readString(onboardingData.agent_avatar_url) ||
    readString(nestedCompany.avatar_id) ||
    DEFAULT_AGENT_AVATAR_ID;

  const flatStarterTasks = normalizeStringList(onboardingData.starter_tasks, MAX_STARTER_TASKS);
  const nestedStarterTasks = normalizeStringList(nestedTask.starter_tasks, MAX_STARTER_TASKS);
  const legacyStarterTask = readString(onboardingData.starter_task) || readString(nestedTask.starter_task);
  const starterTasks = resolveStarterTasks({
    companyName,
    goals: resolvedGoals,
    missionGoals,
    flatStarterTasks,
    nestedStarterTasks,
    legacyStarterTask,
  });

  const approvalPolicy =
    normalizeApprovalPolicy(onboardingData.approval_policy) ||
    normalizeApprovalPolicy(nestedTask.approval_policy) ||
    defaultApprovalPolicy();

  const flatSuggestions = normalizeAgentSuggestions(onboardingData.agent_suggestions);
  const nestedSuggestions = normalizeAgentSuggestions(nestedTask.agent_suggestions);
  const agentSuggestions = flatSuggestions.length > 0 ? flatSuggestions : nestedSuggestions;

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
    agentTone,
    agentAvatarId,
    starterTask: starterTasks.starterTask,
    starterTasks: starterTasks.starterTasks,
    approvalPolicy,
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

  const hasGoalsPatch = Array.isArray(rawPatch.goals) || Array.isArray(nestedStrategy.goals);
  const patchGoals = normalizeStringList(nestedStrategy.goals ?? rawPatch.goals, MAX_GOALS);
  if (hasGoalsPatch) {
    next.goals = patchGoals;
    next.missionGoals = toMissionGoalsText(patchGoals);
  }

  const missionGoalsCandidate = readString(
    nestedStrategy.mission_goals ?? rawPatch.mission_goals ?? rawPatch.mission
  );
  if (missionGoalsCandidate || rawPatch.mission_goals === "" || rawPatch.mission === "") {
    next.missionGoals = missionGoalsCandidate;
    if (!hasGoalsPatch) {
      next.goals = toGoalsArray(missionGoalsCandidate);
    }
  }

  const agentNameCandidate = readString(nestedCompany.chief_name ?? rawPatch.agent_name);
  if (agentNameCandidate) {
    next.agentName = agentNameCandidate;
  }

  const toneCandidate = normalizeTone(nestedCompany.tone ?? rawPatch.agent_tone);
  if (toneCandidate) {
    next.agentTone = toneCandidate;
  }

  const avatarCandidate = readString(
    nestedCompany.avatar_id ?? rawPatch.agent_avatar_id ?? rawPatch.agent_avatar_url
  );
  if (avatarCandidate) {
    next.agentAvatarId = avatarCandidate;
  }

  const patchSuggestions = normalizeAgentSuggestions(
    nestedTask.agent_suggestions ?? rawPatch.agent_suggestions
  );
  if (Array.isArray(rawPatch.agent_suggestions) || Array.isArray(nestedTask.agent_suggestions)) {
    next.agentSuggestions = patchSuggestions;
  }

  const patchStarterTasks = normalizeStringList(
    nestedTask.starter_tasks ?? rawPatch.starter_tasks,
    MAX_STARTER_TASKS
  );
  const hasStarterTasksPatch = Array.isArray(rawPatch.starter_tasks) || Array.isArray(nestedTask.starter_tasks);
  if (hasStarterTasksPatch) {
    next.starterTasks = patchStarterTasks;
  }

  const starterTaskCandidate = readString(nestedTask.starter_task ?? rawPatch.starter_task);
  if (starterTaskCandidate) {
    if (next.starterTasks.length > 0) {
      next.starterTasks = [starterTaskCandidate, ...next.starterTasks.slice(1)];
    } else {
      next.starterTasks = [starterTaskCandidate];
    }
  }

  if (rawPatch.approval_policy !== undefined || nestedTask.approval_policy !== undefined) {
    const approvalPolicyCandidate = normalizeApprovalPolicy(
      nestedTask.approval_policy ?? rawPatch.approval_policy
    );
    if (approvalPolicyCandidate) {
      next.approvalPolicy = approvalPolicyCandidate;
    }
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

  if (!next.agentName) {
    next.agentName = DEFAULT_AGENT_NAME;
  }

  if (!next.agentTone) {
    next.agentTone = DEFAULT_AGENT_TONE;
  }

  if (!next.agentAvatarId) {
    next.agentAvatarId = DEFAULT_AGENT_AVATAR_ID;
  }

  if (!next.goals.length && next.missionGoals) {
    next.goals = toGoalsArray(next.missionGoals);
  }

  if (!next.missionGoals && next.goals.length) {
    next.missionGoals = toMissionGoalsText(next.goals);
  }

  if (!next.starterTasks.length) {
    next.starterTasks = [buildStarterTask(next.companyName, next.goals[0] || next.missionGoals)];
  }

  next.starterTask = next.starterTasks[0];

  if (!next.approvalPolicy) {
    next.approvalPolicy = defaultApprovalPolicy();
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
        tone: state.agentTone,
        avatar_id: state.agentAvatarId,
      },
      strategy: {
        mission_goals: state.missionGoals,
        goals: state.goals,
        products_services: state.productsServices,
        scan_results: state.scanResults,
      },
      task: {
        starter_task: state.starterTask,
        starter_tasks: state.starterTasks,
        approval_policy: state.approvalPolicy,
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
    agent_tone: state.agentTone,
    agent_avatar_id: state.agentAvatarId,
    agent_avatar_url: state.agentAvatarId,
    starter_task: state.starterTask,
    starter_tasks: state.starterTasks,
    approval_policy: state.approvalPolicy,
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
