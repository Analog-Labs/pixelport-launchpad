export const MAX_ONBOARDING_GOALS = 3;

export const GOAL_PRESET_OPTIONS = [
  "Increase qualified pipeline",
  "Improve conversion from existing traffic",
  "Launch consistent founder-led content",
  "Build predictable outbound pipeline",
  "Improve retention and expansion revenue",
  "Sharpen category positioning",
  "Reduce average sales cycle length",
] as const;

export const AGENT_TONE_OPTIONS = [
  {
    id: "strategic",
    label: "Strategic",
    description: "Outcome-first planning with clear prioritization.",
  },
  {
    id: "professional",
    label: "Professional",
    description: "Structured and executive-ready communication.",
  },
  {
    id: "concise",
    label: "Concise",
    description: "Short, direct updates with minimal fluff.",
  },
  {
    id: "warm",
    label: "Warm",
    description: "Supportive language that still drives execution.",
  },
  {
    id: "analytical",
    label: "Analytical",
    description: "Data-heavy framing with explicit tradeoffs.",
  },
  {
    id: "bold",
    label: "Bold",
    description: "Strong point of view and decisive recommendations.",
  },
] as const;

export type AgentToneId = (typeof AGENT_TONE_OPTIONS)[number]["id"];

export const AGENT_AVATAR_OPTIONS = [
  {
    id: "amber-command",
    label: "Command",
    accent: "linear-gradient(135deg, hsl(38 60% 58%), hsl(32 68% 46%))",
    monogram: "CM",
  },
  {
    id: "steel-operator",
    label: "Operator",
    accent: "linear-gradient(135deg, hsl(210 8% 55%), hsl(215 12% 38%))",
    monogram: "OP",
  },
  {
    id: "teal-orbit",
    label: "Orbit",
    accent: "linear-gradient(135deg, hsl(178 44% 48%), hsl(191 48% 34%))",
    monogram: "OR",
  },
  {
    id: "copper-vector",
    label: "Vector",
    accent: "linear-gradient(135deg, hsl(24 72% 56%), hsl(18 70% 42%))",
    monogram: "VC",
  },
  {
    id: "slate-grid",
    label: "Grid",
    accent: "linear-gradient(135deg, hsl(221 14% 48%), hsl(226 16% 34%))",
    monogram: "GR",
  },
  {
    id: "rose-signal",
    label: "Signal",
    accent: "linear-gradient(135deg, hsl(346 63% 58%), hsl(352 58% 43%))",
    monogram: "SG",
  },
] as const;

export type AgentAvatarId = (typeof AGENT_AVATAR_OPTIONS)[number]["id"];

export const APPROVAL_MODE_OPTIONS = [
  {
    id: "strict",
    label: "Strict",
    description: "Escalate high-impact actions for approval before execution.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Move fast on routine work, escalate only key decisions.",
  },
  {
    id: "autonomous",
    label: "Autonomous",
    description: "Allow broad execution with guardrails still enforced.",
  },
] as const;

export type ApprovalModeId = (typeof APPROVAL_MODE_OPTIONS)[number]["id"];

export type ApprovalPolicyInput = {
  mode: ApprovalModeId;
  guardrails: {
    publish: boolean;
    paid_spend: boolean;
    outbound_messages: boolean;
    major_strategy_changes: boolean;
  };
};

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicyInput = {
  mode: "balanced",
  guardrails: {
    publish: true,
    paid_spend: true,
    outbound_messages: true,
    major_strategy_changes: true,
  },
};

function compact(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildGoalMappedTask(goal: string, companyName: string): string {
  const safeGoal = compact(goal);
  const safeCompanyName = compact(companyName) || "the company";
  const lower = safeGoal.toLowerCase();

  if (lower.includes("pipeline") || lower.includes("lead") || lower.includes("outbound")) {
    return `Create a 14-day pipeline sprint for ${safeCompanyName} with daily channel actions and owner check-ins for: ${safeGoal}.`;
  }

  if (lower.includes("conversion") || lower.includes("traffic") || lower.includes("sales cycle")) {
    return `Audit conversion friction for ${safeCompanyName} and ship a two-week optimization backlog tied to: ${safeGoal}.`;
  }

  if (lower.includes("content") || lower.includes("position") || lower.includes("category")) {
    return `Build a two-week content and messaging execution plan for ${safeCompanyName} aligned to: ${safeGoal}.`;
  }

  if (lower.includes("retention") || lower.includes("expansion")) {
    return `Design a retention and expansion action plan for ${safeCompanyName} with weekly KPI reviews for: ${safeGoal}.`;
  }

  return `Create a focused 14-day execution plan for ${safeCompanyName} aligned to: ${safeGoal}.`;
}

export function buildGoalMappedTasks(goals: string[], companyName: string): string[] {
  return goals
    .map((goal) => compact(goal))
    .filter(Boolean)
    .slice(0, MAX_ONBOARDING_GOALS)
    .map((goal) => buildGoalMappedTask(goal, companyName));
}
