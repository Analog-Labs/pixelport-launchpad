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
  durationMs?: number;
  costCents?: number;
  startedAt: string;
  completedAt?: string;
}

export interface HeartbeatRunEvent {
  id: string;
  type: string;
  message?: string;
  createdAt: string;
}

export type IssueStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';

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
  assignee?: IssueAssignee;
  number?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueComment {
  id: string;
  body: string;
  author?: string;
  createdAt: string;
}

export interface PaperclipApproval {
  id: string;
  type: string;
  content: string;
  platform?: string;
  createdBy?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  /** Original structured payload from Chief — used for resubmit */
  payload?: Record<string, unknown>;
}

export interface SidebarBadges {
  approvals: number;
  tasks?: number;
  competitors?: number;
  chat?: number;
}

export interface DashboardSummary {
  pendingApprovals?: number;
  activeAgents?: number;
  weekCostCents?: number;
  currentTask?: string;
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
