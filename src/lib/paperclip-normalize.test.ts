import { describe, expect, it } from 'vitest';
import {
  normalizeAgentListResponse,
  normalizeApprovalsResponse,
  normalizeDashboardSummary,
  normalizeHeartbeatRunsResponse,
  normalizeSidebarBadges,
} from '@/lib/paperclip-normalize';

describe('paperclip normalizers', () => {
  it('normalizes raw array agent payloads from Paperclip', () => {
    const normalized = normalizeAgentListResponse([
      {
        id: 'a-1',
        name: 'Chief',
        status: 'idle',
        spentMonthlyCents: 120,
        budgetMonthlyCents: 1000,
      },
    ]);

    expect(normalized.agents).toHaveLength(1);
    expect(normalized.agents[0]).toMatchObject({
      id: 'a-1',
      name: 'Chief',
      status: 'online',
      budgetUsedCents: 120,
      budgetLimitCents: 1000,
    });
  });

  it('normalizes dashboard summary nested cost and agent values', () => {
    const normalized = normalizeDashboardSummary({
      agents: { active: 3 },
      costs: { monthSpendCents: 450 },
      pendingApprovals: 2,
    });

    expect(normalized).toEqual({
      activeAgents: 3,
      weekCostCents: 450,
      pendingApprovals: 2,
      currentTask: undefined,
    });
  });

  it('normalizes raw array run and approval payloads', () => {
    const runs = normalizeHeartbeatRunsResponse([
      { id: 'r-1', status: 'success', createdAt: '2026-03-20T00:00:00Z' },
    ]);
    const approvals = normalizeApprovalsResponse([
      { id: 'ap-1', type: 'hire_agent', status: 'pending', createdAt: '2026-03-20T00:00:00Z' },
    ]);

    expect(runs.runs).toHaveLength(1);
    expect(runs.runs[0].result).toBe('success');
    expect(approvals.approvals).toHaveLength(1);
    expect(approvals.approvals[0].content).toBe('');
  });

  it('maps sidebar badge fallbacks from Paperclip keys', () => {
    const normalized = normalizeSidebarBadges({
      approvals: 4,
      inbox: 7,
      failedRuns: 2,
    });

    expect(normalized).toEqual({
      approvals: 4,
      tasks: 7,
      competitors: undefined,
      chat: 2,
    });
  });
});
