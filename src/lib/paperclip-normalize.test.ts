import { describe, expect, it } from 'vitest';
import {
  normalizeAgentListResponse,
  normalizeApprovalsResponse,
  normalizeDashboardSummary,
  normalizeHeartbeatRunsResponse,
  normalizeRunEventsResponse,
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
      {
        id: 'r-1',
        status: 'timed_out',
        startedAt: '2026-03-20T00:00:00Z',
        finishedAt: '2026-03-20T00:00:02Z',
        contextSnapshot: { wakeReason: 'provisioning_readiness_retry_2' },
      },
    ]);
    const approvals = normalizeApprovalsResponse([
      {
        id: 'ap-1',
        type: 'approve_ceo_strategy',
        status: 'pending',
        createdAt: '2026-03-20T00:00:00Z',
        payload: {
          title: 'Week 1 Strategy Checkpoint',
          summary: 'Initial strategy draft',
          requestedAction: 'Approve or request revisions',
          seedTag: 'pixelport_onboarding_kickoff_v1',
        },
      },
    ]);

    expect(runs.runs).toHaveLength(1);
    expect(runs.runs[0].result).toBe('failed');
    expect(runs.runs[0].durationMs).toBe(2000);
    expect(runs.runs[0].name).toBe('Provisioning Readiness Retry 2');
    expect(approvals.approvals).toHaveLength(1);
    expect(approvals.approvals[0].title).toBe('Week 1 Strategy Checkpoint');
    expect(approvals.approvals[0].content).toContain('Initial strategy draft');
    expect(approvals.approvals[0].requestedAction).toBe('Approve or request revisions');
  });

  it('normalizes run events with numeric ids and eventType field', () => {
    const events = normalizeRunEventsResponse([
      {
        id: 7,
        eventType: 'adapter.invoke',
        message: 'adapter invocation',
        createdAt: '2026-03-20T00:00:00Z',
      },
    ]);

    expect(events.events).toEqual([
      {
        id: '7',
        type: 'adapter.invoke',
        message: 'adapter invocation',
        createdAt: '2026-03-20T00:00:00Z',
      },
    ]);
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
