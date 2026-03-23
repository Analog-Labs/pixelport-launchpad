import type {
  AgentListResponse,
  ApprovalsResponse,
  DashboardSummary,
  HeartbeatRun,
  HeartbeatRunEvent,
  HeartbeatRunsResponse,
  IssueComment,
  IssueStatus,
  IssuesResponse,
  LiveRun,
  LiveRunsResponse,
  PaperclipAgent,
  PaperclipApproval,
  PaperclipIssue,
  SidebarBadges,
} from '@/lib/paperclip-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return undefined;
}

function parseIsoTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function humanizeToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const normalized = raw
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return undefined;
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeAgentStatus(status: unknown): PaperclipAgent['status'] {
  const raw = readString(status)?.toLowerCase();
  if (raw === 'running' || raw === 'active' || raw === 'busy') return 'running';
  if (raw === 'error' || raw === 'failed') return 'error';
  if (raw === 'offline' || raw === 'paused' || raw === 'stopped') return 'offline';
  return 'online';
}

function normalizeRunStatus(status: unknown, result: unknown): LiveRun['status'] {
  const raw = readString(status)?.toLowerCase();
  const outcome = readString(result)?.toLowerCase();
  if (
    raw === 'failed'
    || raw === 'error'
    || raw === 'timed_out'
    || raw === 'timeout'
    || raw === 'cancelled'
    || raw === 'canceled'
    || outcome === 'failed'
    || outcome === 'error'
  ) {
    return 'failed';
  }
  if (
    raw === 'complete'
    || raw === 'completed'
    || raw === 'success'
    || raw === 'succeeded'
    || outcome === 'success'
    || outcome === 'succeeded'
  ) {
    return 'complete';
  }
  return 'running';
}

function normalizeIssueStatus(value: unknown): IssueStatus {
  const raw = readString(value)?.toLowerCase();
  if (raw === 'in_progress' || raw === 'in-progress') return 'in_progress';
  if (raw === 'in_review' || raw === 'review' || raw === 'blocked') return 'in_review';
  if (raw === 'done' || raw === 'closed' || raw === 'completed') return 'done';
  return 'todo';
}

function normalizeApprovalStatus(value: unknown): PaperclipApproval['status'] {
  const raw = readString(value)?.toLowerCase();
  if (raw === 'approved') return 'approved';
  if (raw === 'rejected') return 'rejected';
  return 'pending';
}

function normalizeAgent(raw: unknown): PaperclipAgent | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw.id);
  const name = readString(raw.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    status: normalizeAgentStatus(raw.status),
    currentTask: readString(raw.currentTask)
      ?? readString(raw.current_task)
      ?? readString(raw.activeTask)
      ?? readString(raw.task),
    budgetUsedCents: readNumber(raw.budgetUsedCents) ?? readNumber(raw.spentMonthlyCents),
    budgetLimitCents: readNumber(raw.budgetLimitCents) ?? readNumber(raw.budgetMonthlyCents),
  };
}

function normalizeLiveRun(raw: unknown): LiveRun | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw.id);
  const agentId =
    readString(raw.agentId)
    ?? readString(raw.agent_id)
    ?? (isRecord(raw.agent) ? readString(raw.agent.id) : undefined);
  if (!id || !agentId) return null;

  return {
    id,
    agentId,
    description: readString(raw.description)
      ?? readString(raw.currentTask)
      ?? readString(raw.message),
    status: normalizeRunStatus(raw.status, raw.result),
  };
}

function normalizeHeartbeatRun(raw: unknown): HeartbeatRun | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw.id);
  if (!id) return null;

  const runStatus = normalizeRunStatus(raw.status, raw.result);
  const result = runStatus === 'failed' ? 'failed' : 'success';
  const startedAt =
    readString(raw.startedAt)
    ?? readString(raw.started_at)
    ?? readString(raw.createdAt)
    ?? new Date().toISOString();
  const completedAt =
    readString(raw.completedAt)
    ?? readString(raw.completed_at)
    ?? readString(raw.finishedAt)
    ?? readString(raw.finished_at);
  const durationFromTimestamps = (() => {
    const startMs = parseIsoTimestamp(startedAt);
    const finishMs = parseIsoTimestamp(completedAt);
    if (startMs === undefined || finishMs === undefined) return undefined;
    const delta = finishMs - startMs;
    return delta >= 0 ? delta : undefined;
  })();
  const contextSnapshot = isRecord(raw.contextSnapshot) ? raw.contextSnapshot : null;
  const wakeReason = contextSnapshot ? readString(contextSnapshot.wakeReason) : undefined;
  const issueId = contextSnapshot ? readString(contextSnapshot.issueId) : undefined;
  const triggerDetail = readString(raw.triggerDetail);
  const errorCode = readString(raw.errorCode);
  const derivedName =
    readString(raw.name)
    ?? readString(raw.title)
    ?? (wakeReason ? humanizeToken(wakeReason) : undefined)
    ?? (errorCode ? humanizeToken(errorCode) : undefined)
    ?? (
      triggerDetail && triggerDetail.toLowerCase() !== 'system'
        ? humanizeToken(triggerDetail)
        : undefined
    );

  return {
    id,
    agentId: readString(raw.agentId) ?? readString(raw.agent_id),
    name: derivedName,
    result,
    status: readString(raw.status) ?? runStatus,
    durationMs:
      readNumber(raw.durationMs)
      ?? readNumber(raw.duration_ms)
      ?? durationFromTimestamps,
    costCents: readNumber(raw.costCents) ?? readNumber(raw.cost_cents),
    startedAt,
    completedAt,
    error: readString(raw.error),
    wakeReason,
    issueId,
  };
}

function normalizeIssueRecord(raw: unknown): PaperclipIssue | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw.id);
  if (!id) return null;

  const assigneeRecord = isRecord(raw.assignee)
    ? raw.assignee
    : isRecord(raw.assigneeAgent)
      ? raw.assigneeAgent
      : null;

  return {
    id,
    title: readString(raw.title) ?? 'Untitled task',
    description: readString(raw.description),
    status: normalizeIssueStatus(raw.status),
    assignee: assigneeRecord
      ? {
        id: readString(assigneeRecord.id) ?? 'unknown',
        name: readString(assigneeRecord.name) ?? 'Agent',
        status: normalizeAgentStatus(assigneeRecord.status),
      }
      : undefined,
    number: readNumber(raw.number) ?? readNumber(raw.issueNumber),
    createdAt: readString(raw.createdAt) ?? readString(raw.created_at),
    updatedAt: readString(raw.updatedAt) ?? readString(raw.updated_at),
  };
}

function normalizeComment(raw: unknown): IssueComment | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw.id);
  if (!id) return null;
  const authorAgentId = readString(raw.authorAgentId) ?? readString(raw.author_agent_id);
  const authorUserId = readString(raw.authorUserId) ?? readString(raw.author_user_id);

  return {
    id,
    body: readString(raw.body) ?? readString(raw.content) ?? '',
    author:
      readString(raw.author)
      ?? readString(raw.authorName)
      ?? (authorUserId ? 'You' : undefined)
      ?? (authorAgentId ? 'Chief' : undefined),
    createdAt: readString(raw.createdAt) ?? readString(raw.created_at) ?? new Date().toISOString(),
    authorAgentId,
    authorUserId,
  };
}

function normalizeApproval(raw: unknown): PaperclipApproval | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw.id);
  if (!id) return null;

  const payload = isRecord(raw.payload) ? raw.payload : undefined;
  const payloadContent = payload ? readString(payload.content) : undefined;
  const payloadTitle = payload ? readString(payload.title) : undefined;
  const payloadSummary = payload ? readString(payload.summary) : undefined;
  const payloadRequestedAction = payload ? readString(payload.requestedAction) : undefined;
  const payloadSeedTag = payload ? readString(payload.seedTag) : undefined;
  const composedContent = [
    payloadContent,
    payloadSummary,
    payloadRequestedAction,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n\n');

  return {
    id,
    type: readString(raw.type) ?? 'Approval',
    content: readString(raw.content) ?? composedContent,
    title: payloadTitle,
    summary: payloadSummary,
    requestedAction: payloadRequestedAction,
    seedTag: payloadSeedTag,
    platform: readString(raw.platform),
    createdBy: readString(raw.createdBy) ?? readString(raw.created_by) ?? readString(raw.agentName),
    createdAt: readString(raw.createdAt) ?? readString(raw.created_at) ?? new Date().toISOString(),
    status: normalizeApprovalStatus(raw.status),
    payload,
  };
}

function normalizeRunEvent(raw: unknown): HeartbeatRunEvent | null {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (!id) return null;

  return {
    id,
    type: readString(raw.type) ?? readString(raw.eventType) ?? 'event',
    message: readString(raw.message),
    createdAt: readString(raw.createdAt) ?? readString(raw.created_at) ?? new Date().toISOString(),
  };
}

export function normalizeDashboardSummary(raw: unknown): DashboardSummary {
  if (!isRecord(raw)) return {};

  const agents = isRecord(raw.agents) ? raw.agents : {};
  const costs = isRecord(raw.costs) ? raw.costs : {};

  return {
    pendingApprovals: readNumber(raw.pendingApprovals),
    activeAgents: readNumber(raw.activeAgents) ?? readNumber(agents.active),
    weekCostCents:
      readNumber(raw.weekCostCents)
      ?? readNumber(costs.weekSpendCents)
      ?? readNumber(costs.monthSpendCents),
    currentTask: readString(raw.currentTask),
  };
}

export function normalizeSidebarBadges(raw: unknown): SidebarBadges {
  if (!isRecord(raw)) return { approvals: 0 };

  return {
    approvals: readNumber(raw.approvals) ?? 0,
    tasks: readNumber(raw.tasks) ?? readNumber(raw.inbox),
    competitors: readNumber(raw.competitors),
    chat: readNumber(raw.chat) ?? readNumber(raw.failedRuns),
  };
}

export function normalizeAgentListResponse(raw: unknown): AgentListResponse {
  const source = isRecord(raw) ? asArray(raw.agents) : asArray(raw);
  return {
    agents: source.map(normalizeAgent).filter((agent): agent is PaperclipAgent => agent !== null),
  };
}

export function normalizeLiveRunsResponse(raw: unknown): LiveRunsResponse {
  const source = isRecord(raw) ? asArray(raw.runs) : asArray(raw);
  return {
    runs: source.map(normalizeLiveRun).filter((run): run is LiveRun => run !== null),
  };
}

export function normalizeHeartbeatRunsResponse(raw: unknown): HeartbeatRunsResponse {
  const source = isRecord(raw) ? asArray(raw.runs) : asArray(raw);
  return {
    runs: source
      .map(normalizeHeartbeatRun)
      .filter((run): run is HeartbeatRun => run !== null),
  };
}

export function normalizeIssuesResponse(raw: unknown): IssuesResponse {
  const source = isRecord(raw) ? asArray(raw.issues) : asArray(raw);
  return {
    issues: source
      .map(normalizeIssueRecord)
      .filter((issue): issue is PaperclipIssue => issue !== null),
  };
}

export function normalizeIssue(raw: unknown): PaperclipIssue | null {
  return normalizeIssueRecord(raw);
}

export function normalizeTaskDetail(raw: unknown): PaperclipIssue | null {
  return normalizeIssueRecord(raw);
}

export function normalizeCommentsResponse(raw: unknown): { comments: IssueComment[] } {
  const source = isRecord(raw) ? asArray(raw.comments) : asArray(raw);
  return {
    comments: source
      .map(normalizeComment)
      .filter((comment): comment is IssueComment => comment !== null),
  };
}

export function normalizeApprovalsResponse(raw: unknown): ApprovalsResponse {
  const source = isRecord(raw) ? asArray(raw.approvals) : asArray(raw);
  return {
    approvals: source
      .map(normalizeApproval)
      .filter((approval): approval is PaperclipApproval => approval !== null),
  };
}

export function normalizeRunDetail(raw: unknown): HeartbeatRun | null {
  return normalizeHeartbeatRun(raw);
}

export function normalizeRunEventsResponse(raw: unknown): { events: HeartbeatRunEvent[] } {
  const source = isRecord(raw) ? asArray(raw.events) : asArray(raw);
  return {
    events: source
      .map(normalizeRunEvent)
      .filter((event): event is HeartbeatRunEvent => event !== null),
  };
}
