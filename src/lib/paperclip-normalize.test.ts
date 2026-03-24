import { describe, expect, it } from 'vitest';
import {
  normalizeAgentListResponse,
  normalizeAgentCostsResponse,
  normalizeActivityResponse,
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
      agents: { active: 3, running: 1, paused: 1, error: 1 },
      tasks: { open: 4, inProgress: 2, blocked: 1, done: 8 },
      costs: { monthSpendCents: 450, monthBudgetCents: 1000, monthUtilizationPercent: 45 },
      pendingApprovals: 2,
    });

    expect(normalized).toEqual({
      agents: { active: 3, running: 1, paused: 1, error: 1 },
      tasks: { open: 4, inProgress: 2, blocked: 1, done: 8 },
      costs: { monthSpendCents: 450, monthBudgetCents: 1000, monthUtilizationPercent: 45 },
      pendingApprovals: 2,
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
      inbox: 7,
      failedRuns: 2,
      tasks: undefined,
      competitors: undefined,
      chat: undefined,
    });
  });

  it('normalizes activity entries from wrapped payload', () => {
    const normalized = normalizeActivityResponse({
      activity: [
        {
          id: 1,
          actorType: 'agent',
          actorId: 'agent-1',
          action: 'completed issue',
          entityType: 'issue',
          entityId: 'issue-1',
          createdAt: '2026-03-20T00:00:00Z',
        },
      ],
    });

    expect(normalized.entries).toEqual([
      {
        id: '1',
        actorType: 'agent',
        actorId: 'agent-1',
        action: 'completed issue',
        entityType: 'issue',
        entityId: 'issue-1',
        agentId: undefined,
        details: undefined,
        createdAt: '2026-03-20T00:00:00Z',
      },
    ]);
  });

  it('normalizes agent cost rows from costs payload', () => {
    const normalized = normalizeAgentCostsResponse({
      costs: [
        {
          agentId: 'agent-1',
          agentName: 'Chief',
          agentStatus: 'running',
          costCents: 1234,
          inputTokens: 50,
          outputTokens: 75,
        },
      ],
    });

    expect(normalized.agents).toEqual([
      {
        agentId: 'agent-1',
        agentName: 'Chief',
        agentStatus: 'running',
        costCents: 1234,
        inputTokens: 50,
        outputTokens: 75,
      },
    ]);
  });
});
