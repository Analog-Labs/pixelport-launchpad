/**
 * Shared TypeScript types for Paperclip API responses.
 * Shapes derived from T1 API contract (docs/paperclip-api-contract.md).
 */

export interface PaperclipAgent {
  id: string;
  name: string;
  /** online = idle, running = actively executing a task, offline = unreachable */
  status: 'online' | 'running' | 'offline' | 'error';
  currentTask?: string;
  budgetUsedCents?: number;
  budgetLimitCents?: number;
}

export interface PaperclipAgentDetail extends PaperclipAgent {
  role?: string;
  description?: string;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LiveRun {
  id: string;
  agentId: string;
  description?: string;
  status: 'running' | 'complete' | 'failed';
}

export interface HeartbeatRun {
  id: string;
  agentId?: string;
  name?: string;
  result: 'success' | 'failed';
  status?: string;
  durationMs?: number;
  costCents?: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  wakeReason?: string;
  issueId?: string;
}

export interface HeartbeatRunEvent {
  id: string;
  type: string;
  message?: string;
  createdAt: string;
}

export type IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export interface IssueAssignee {
  id: string;
  name: string;
  status?: 'online' | 'running' | 'offline';
}

export interface PaperclipIssue {
  id: string;
  title: string;
  description?: string;
  status: IssueStatus;
  priority?: IssuePriority;
  assignee?: IssueAssignee;
  assigneeAgentId?: string;
  number?: number;
  identifier?: string;
  projectId?: string;
  createdByUserId?: string;
  createdByAgentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueComment {
  id: string;
  body: string;
  author?: string;
  createdAt: string;
  authorAgentId?: string;
  authorUserId?: string;
}

export interface PaperclipApproval {
  id: string;
  type: string;
  content: string;
  title?: string;
  summary?: string;
  requestedAction?: string;
  seedTag?: string;
  platform?: string;
  createdBy?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  /** Original structured payload from Chief — used for resubmit */
  payload?: Record<string, unknown>;
}

export interface SidebarBadges {
  approvals: number;
  inbox?: number;
  failedRuns?: number;
  tasks?: number;
  competitors?: number;
  chat?: number;
}

export interface DashboardSummary {
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
}

export interface ActivityEntry {
  id: string;
  actorType: 'user' | 'agent' | 'system';
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  agentId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityResponse {
  entries: ActivityEntry[];
}

export interface AgentCost {
  agentId: string;
  agentName: string;
  agentStatus: string;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AgentCostsResponse {
  agents: AgentCost[];
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: IssuePriority;
  assigneeAgentId?: string;
}

export interface AgentListResponse {
  agents: PaperclipAgent[];
}

export interface LiveRunsResponse {
  runs: LiveRun[];
}

export interface IssuesResponse {
  issues: PaperclipIssue[];
}

export interface ApprovalsResponse {
  approvals: PaperclipApproval[];
}

export interface HeartbeatRunsResponse {
  runs: HeartbeatRun[];
}
