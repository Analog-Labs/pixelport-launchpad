import { createHash } from 'crypto';

const GATEWAY_HOOKS_PATH = '/hooks/agent';

type JsonRecord = Record<string, unknown>;

export type BootstrapTriggerResult = {
  ok: boolean;
  status: number;
  body: string;
};

export function deriveHooksToken(gatewayToken: string): string {
  const digest = createHash('sha256')
    .update(`${gatewayToken}:hooks`)
    .digest('hex');

  return `hk-${digest}`;
}

export function buildBootstrapHooksConfig(gatewayToken: string): Record<string, unknown> {
  return {
    enabled: true,
    token: deriveHooksToken(gatewayToken),
    path: '/hooks',
    mappings: [
      {
        match: { path: 'onboarding-bootstrap' },
        action: 'agent',
        agentId: 'main',
        deliver: true,
      },
    ],
  };
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeGoals(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 6);
}

function summarizeScanResults(scanResults: unknown): string | null {
  if (!scanResults || typeof scanResults !== 'object') {
    return null;
  }

  const record = scanResults as JsonRecord;
  const summaryParts = [
    normalizeText(record.company_description),
    normalizeText(record.value_proposition),
    normalizeText(record.target_audience),
    normalizeText(record.brand_voice),
    normalizeText(record.industry),
  ].filter((entry): entry is string => !!entry);

  if (summaryParts.length === 0) {
    return null;
  }

  return summaryParts.slice(0, 3).join(' ');
}

export function buildOnboardingBootstrapMessage(params: {
  tenantName: string;
  onboardingData: JsonRecord | null | undefined;
}): string {
  const onboardingData = params.onboardingData ?? {};
  const companyUrl = normalizeText(onboardingData.company_url);
  const goals = normalizeGoals(onboardingData.goals);
  const agentName = normalizeText(onboardingData.agent_name) || 'Luna';
  const scanSummary = summarizeScanResults(onboardingData.scan_results);

  const lines = [
    `You are ${agentName}, and this is your first autonomous onboarding run for ${params.tenantName}.`,
    'Start the post-onboarding research sequence immediately.',
    companyUrl ? `Company website: ${companyUrl}` : 'Company website: not provided.',
    goals.length > 0 ? `Goals: ${goals.join(' | ')}` : 'Goals: none provided during onboarding.',
    scanSummary ? `Website scan summary: ${scanSummary}` : 'Website scan summary: use SOUL.md and the live website for the missing details.',
    '',
    'Execution requirements:',
    '1. Mark any pending vault sections as "populating" before you work on them.',
    '2. Create real task records in PixelPort for each major research activity so the dashboard shows backend-driven progress.',
    '3. Update the vault with concrete findings, add competitor profiles when you have evidence, and create at least one completed strategy or report task summarizing your initial findings.',
    '4. If you generate content ideas, save them as draft_content tasks that require approval.',
    '5. If any information is missing, record what you learned and what you still need from the human instead of waiting silently.',
    '',
    'Keep your final reply short. The important part is writing the work back into the PixelPort APIs.',
  ];

  return lines.join('\n');
}

export async function triggerOnboardingBootstrap(params: {
  gatewayUrl: string;
  gatewayToken: string;
  message: string;
  agentId?: string;
}): Promise<BootstrapTriggerResult> {
  const response = await fetch(`${params.gatewayUrl}${GATEWAY_HOOKS_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deriveHooksToken(params.gatewayToken)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Post-Onboarding Bootstrap',
      agentId: params.agentId || 'main',
      message: params.message,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}
