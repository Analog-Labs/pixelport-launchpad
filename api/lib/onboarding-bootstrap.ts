import { createHash } from 'crypto';

const GATEWAY_HOOKS_AGENT_PATH = '/hooks/agent';
const GATEWAY_HOOKS_MAPPED_PATH = '/hooks/onboarding-bootstrap';

type JsonRecord = Record<string, unknown>;

export type AgentHookDispatchResult = {
  ok: boolean;
  status: number;
  body: string;
};

function buildHookDispatchUrl(gatewayUrl: string, hookPath: string, hookToken: string): string {
  const normalizedGatewayUrl = gatewayUrl.trim();
  const normalizedGatewayBase = normalizedGatewayUrl.endsWith('/')
    ? normalizedGatewayUrl
    : `${normalizedGatewayUrl}/`;
  const normalizedHookPath = hookPath.replace(/^\/+/, '');
  const url = new URL(normalizedHookPath, normalizedGatewayBase);
  url.searchParams.set('token', hookToken);
  return url.toString();
}

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
    '2. Use the workspace contract files at the root plus the `pixelport/` namespace for durable runtime artifacts.',
    '3. Write concrete findings into canonical workspace artifacts under `pixelport/` (vault snapshots, runtime snapshots, and deliverables).',
    '4. Keep output evidence-backed and avoid placeholder content.',
    '5. After you materially update canonical truth, refresh the relevant native memory artifact in `MEMORY.md` or `memory/` during the same work cycle.',
    '6. If any information is missing, record what you learned and what you still need from the human instead of waiting silently.',
    '',
    'Keep your final reply short. The important part is writing durable workspace truth.',
  ];

  return lines.join('\n');
}

export async function dispatchAgentHookMessage(params: {
  gatewayUrl: string;
  gatewayToken: string;
  name: string;
  message: string;
  agentId?: string;
  hookPath?: string;
  hookToken?: string;
}): Promise<AgentHookDispatchResult> {
  const timeoutSignal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(15_000)
      : undefined;
  const hookPath = params.hookPath ?? GATEWAY_HOOKS_AGENT_PATH;
  const hookToken = params.hookToken?.trim() || deriveHooksToken(params.gatewayToken);
  const hookUrl = buildHookDispatchUrl(params.gatewayUrl, hookPath, hookToken);

  try {
    const response = await fetch(hookUrl, {
      method: 'POST',
      headers: {
        // Query token follows OpenClaw hooks contract; headers remain for compatibility across older runtimes.
        Authorization: `Bearer ${hookToken}`,
        'x-openclaw-token': hookToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name,
        agentId: params.agentId || 'main',
        message: params.message,
      }),
      signal: timeoutSignal,
    });

    const body = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown hook dispatch error';
    const causeMessage =
      error instanceof Error &&
      error.cause &&
      typeof error.cause === 'object' &&
      'message' in error.cause &&
      typeof error.cause.message === 'string'
        ? error.cause.message
        : null;

    return {
      ok: false,
      status: 504,
      body: causeMessage ? `${message}: ${causeMessage}` : message,
    };
  }
}

export async function triggerOnboardingBootstrap(params: {
  gatewayUrl: string;
  gatewayToken: string;
  message: string;
  agentId?: string;
}): Promise<AgentHookDispatchResult> {
  const derivedHooksToken = deriveHooksToken(params.gatewayToken);
  const primaryResult = await dispatchAgentHookMessage({
    ...params,
    name: 'Post-Onboarding Bootstrap',
    hookPath: GATEWAY_HOOKS_AGENT_PATH,
    hookToken: derivedHooksToken,
  });

  if (primaryResult.ok) {
    return primaryResult;
  }

  let latestResult = primaryResult;

  // Compatibility fallback for older droplets that still use gateway token at the hook ingress layer.
  if (latestResult.status === 401) {
    const gatewayTokenResult = await dispatchAgentHookMessage({
      ...params,
      name: 'Post-Onboarding Bootstrap',
      hookPath: GATEWAY_HOOKS_AGENT_PATH,
      hookToken: params.gatewayToken,
    });

    if (gatewayTokenResult.ok) {
      return gatewayTokenResult;
    }

    latestResult = gatewayTokenResult;
  }

  // Compatibility fallback for runtimes that only route onboarding via a mapped hook path.
  if (latestResult.status === 401 || latestResult.status === 404 || latestResult.status === 405) {
    const mappedPathResult = await dispatchAgentHookMessage({
      ...params,
      name: 'Post-Onboarding Bootstrap',
      hookPath: GATEWAY_HOOKS_MAPPED_PATH,
      hookToken: derivedHooksToken,
    });

    if (mappedPathResult.ok) {
      return mappedPathResult;
    }

    latestResult = mappedPathResult;

    if (latestResult.status === 401) {
      const mappedPathGatewayTokenResult = await dispatchAgentHookMessage({
        ...params,
        name: 'Post-Onboarding Bootstrap',
        hookPath: GATEWAY_HOOKS_MAPPED_PATH,
        hookToken: params.gatewayToken,
      });

      if (mappedPathGatewayTokenResult.ok) {
        return mappedPathGatewayTokenResult;
      }

      latestResult = mappedPathGatewayTokenResult;
    }
  }

  return latestResult;
}
