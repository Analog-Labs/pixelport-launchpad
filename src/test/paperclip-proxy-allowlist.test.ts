import { describe, expect, it } from 'vitest';
import {
  matchProxyRoute,
  PROXY_ALLOWLIST,
} from '../../api/lib/paperclip-proxy-allowlist';

const COMPANY_ID = 'test-company-abc-123';

describe('PROXY_ALLOWLIST', () => {
  it('has entries for all expected route groups', () => {
    const patterns = PROXY_ALLOWLIST.map((e) => e.proxyPattern);
    expect(patterns).toContain('companies/dashboard');
    expect(patterns).toContain('companies/activity');
    expect(patterns).toContain('companies/costs/by-agent');
    expect(patterns).toContain('agents/:id');
    expect(patterns).toContain('agents/:id/wakeup');
    expect(patterns).toContain('issues/:id');
    expect(patterns).toContain('heartbeat-runs/:runId');
    expect(patterns).toContain('approvals/:id');
  });
});

describe('matchProxyRoute — company-scoped routes', () => {
  it('matches GET companies/dashboard and injects companyId', () => {
    const result = matchProxyRoute('GET', 'companies/dashboard', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/dashboard`,
    });
  });

  it('matches GET companies/sidebar-badges', () => {
    const result = matchProxyRoute('GET', 'companies/sidebar-badges', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/sidebar-badges`,
    });
  });

  it('matches GET companies/agents', () => {
    const result = matchProxyRoute('GET', 'companies/agents', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/agents`,
    });
  });

  it('matches GET companies/issues', () => {
    const result = matchProxyRoute('GET', 'companies/issues', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/issues`,
    });
  });

  it('matches POST companies/issues', () => {
    const result = matchProxyRoute('POST', 'companies/issues', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/issues`,
    });
  });

  it('matches GET companies/activity', () => {
    const result = matchProxyRoute('GET', 'companies/activity', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/activity`,
    });
  });

  it('matches GET companies/heartbeat-runs', () => {
    const result = matchProxyRoute('GET', 'companies/heartbeat-runs', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/heartbeat-runs`,
    });
  });

  it('matches GET companies/live-runs', () => {
    const result = matchProxyRoute('GET', 'companies/live-runs', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/live-runs`,
    });
  });

  it('matches GET companies/approvals', () => {
    const result = matchProxyRoute('GET', 'companies/approvals', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/approvals`,
    });
  });

  it('matches GET companies/costs/summary', () => {
    const result = matchProxyRoute('GET', 'companies/costs/summary', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/costs/summary`,
    });
  });

  it('matches GET companies/costs/by-agent', () => {
    const result = matchProxyRoute('GET', 'companies/costs/by-agent', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/costs/by-agent`,
    });
  });

  it('rejects POST on GET-only company-scoped routes', () => {
    expect(matchProxyRoute('POST', 'companies/dashboard', COMPANY_ID)).toBeNull();
    expect(matchProxyRoute('POST', 'companies/agents', COMPANY_ID)).toBeNull();
  });
});

describe('matchProxyRoute — issue routes', () => {
  it('matches GET agents/:id', () => {
    const result = matchProxyRoute('GET', 'agents/agent-42', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/agents/agent-42' });
  });

  it('matches POST agents/:id/wakeup', () => {
    const result = matchProxyRoute('POST', 'agents/agent-42/wakeup', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/agents/agent-42/wakeup' });
  });

  it('matches GET issues/:id', () => {
    const result = matchProxyRoute('GET', 'issues/issue-42', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/issue-42' });
  });

  it('matches PATCH issues/:id', () => {
    const result = matchProxyRoute('PATCH', 'issues/issue-42', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/issue-42' });
  });

  it('rejects DELETE on issues/:id', () => {
    expect(matchProxyRoute('DELETE', 'issues/issue-42', COMPANY_ID)).toBeNull();
  });

  it('matches GET issues/:id/heartbeat-context', () => {
    const result = matchProxyRoute('GET', 'issues/issue-42/heartbeat-context', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/issue-42/heartbeat-context' });
  });

  it('matches GET issues/:id/comments', () => {
    const result = matchProxyRoute('GET', 'issues/abc/comments', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/abc/comments' });
  });

  it('matches POST issues/:id/comments', () => {
    const result = matchProxyRoute('POST', 'issues/abc/comments', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/abc/comments' });
  });

  it('matches GET issues/:id/comments/:commentId', () => {
    const result = matchProxyRoute('GET', 'issues/abc/comments/c-1', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/abc/comments/c-1' });
  });

  it('matches POST issues/:id/checkout', () => {
    const result = matchProxyRoute('POST', 'issues/abc/checkout', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/abc/checkout' });
  });

  it('matches POST issues/:id/release', () => {
    const result = matchProxyRoute('POST', 'issues/abc/release', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/abc/release' });
  });

  it('matches GET issues/:id/active-run', () => {
    const result = matchProxyRoute('GET', 'issues/abc/active-run', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/abc/active-run' });
  });

  it('matches GET issues/:id/live-runs', () => {
    const result = matchProxyRoute('GET', 'issues/abc/live-runs', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/abc/live-runs' });
  });

  it('matches GET issues/:id/runs', () => {
    const result = matchProxyRoute('GET', 'issues/abc/runs', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/issues/abc/runs' });
  });
});

describe('matchProxyRoute — heartbeat-run routes', () => {
  it('matches GET heartbeat-runs/:runId', () => {
    const result = matchProxyRoute('GET', 'heartbeat-runs/run-1', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/heartbeat-runs/run-1' });
  });

  it('matches GET heartbeat-runs/:runId/events', () => {
    const result = matchProxyRoute('GET', 'heartbeat-runs/run-1/events', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/heartbeat-runs/run-1/events' });
  });

  it('matches GET heartbeat-runs/:runId/log', () => {
    const result = matchProxyRoute('GET', 'heartbeat-runs/run-1/log', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/heartbeat-runs/run-1/log' });
  });
});

describe('matchProxyRoute — approval routes', () => {
  it('matches GET approvals/:id', () => {
    const result = matchProxyRoute('GET', 'approvals/appr-1', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/approvals/appr-1' });
  });

  it('matches GET approvals/:id/issues', () => {
    const result = matchProxyRoute('GET', 'approvals/appr-1/issues', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/approvals/appr-1/issues' });
  });

  it('matches POST approvals/:id/approve', () => {
    const result = matchProxyRoute('POST', 'approvals/appr-1/approve', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/approvals/appr-1/approve' });
  });

  it('matches POST approvals/:id/reject', () => {
    const result = matchProxyRoute('POST', 'approvals/appr-1/reject', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/approvals/appr-1/reject' });
  });

  it('matches POST approvals/:id/request-revision', () => {
    const result = matchProxyRoute('POST', 'approvals/appr-1/request-revision', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/approvals/appr-1/request-revision' });
  });

  it('matches POST approvals/:id/resubmit', () => {
    const result = matchProxyRoute('POST', 'approvals/appr-1/resubmit', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/approvals/appr-1/resubmit' });
  });

  it('matches GET approvals/:id/comments', () => {
    const result = matchProxyRoute('GET', 'approvals/appr-1/comments', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/approvals/appr-1/comments' });
  });

  it('matches POST approvals/:id/comments', () => {
    const result = matchProxyRoute('POST', 'approvals/appr-1/comments', COMPANY_ID);
    expect(result).toEqual({ targetPath: '/api/approvals/appr-1/comments' });
  });
});

describe('matchProxyRoute — security: blocked paths', () => {
  it('rejects bare companies path', () => {
    expect(matchProxyRoute('GET', 'companies', COMPANY_ID)).toBeNull();
    expect(matchProxyRoute('POST', 'companies', COMPANY_ID)).toBeNull();
  });

  it('rejects companies/secrets', () => {
    expect(matchProxyRoute('GET', 'companies/secrets', COMPANY_ID)).toBeNull();
  });

  it('rejects companies/secret-providers', () => {
    expect(matchProxyRoute('GET', 'companies/secret-providers', COMPANY_ID)).toBeNull();
  });

  it('rejects instance/scheduler-heartbeats', () => {
    expect(matchProxyRoute('GET', 'instance/scheduler-heartbeats', COMPANY_ID)).toBeNull();
  });

  it('rejects companies/agent-configurations', () => {
    expect(matchProxyRoute('GET', 'companies/agent-configurations', COMPANY_ID)).toBeNull();
  });

  it('rejects companies/budgets', () => {
    expect(matchProxyRoute('PATCH', 'companies/budgets', COMPANY_ID)).toBeNull();
  });

  it('rejects arbitrary unknown paths', () => {
    expect(matchProxyRoute('GET', 'admin/config', COMPANY_ID)).toBeNull();
    expect(matchProxyRoute('GET', 'users/me', COMPANY_ID)).toBeNull();
    expect(matchProxyRoute('POST', 'companies/agents', COMPANY_ID)).toBeNull();
  });
});

describe('matchProxyRoute — edge cases', () => {
  it('returns null for empty path', () => {
    expect(matchProxyRoute('GET', '', COMPANY_ID)).toBeNull();
  });

  it('handles path with leading slash', () => {
    const result = matchProxyRoute('GET', '/companies/dashboard', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/dashboard`,
    });
  });

  it('handles path with trailing slash', () => {
    const result = matchProxyRoute('GET', 'companies/dashboard/', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/dashboard`,
    });
  });

  it('rejects path traversal attempts', () => {
    expect(matchProxyRoute('GET', '../../../etc/passwd', COMPANY_ID)).toBeNull();
    expect(matchProxyRoute('GET', 'issues/../../secrets', COMPANY_ID)).toBeNull();
  });

  it('rejects dot-segment traversal in dynamic params', () => {
    // ".." in a :id position would cause URL normalization to escape the allowlist
    expect(matchProxyRoute('GET', 'approvals/../issues', COMPANY_ID)).toBeNull();
    expect(matchProxyRoute('GET', 'issues/../comments', COMPANY_ID)).toBeNull();
    expect(matchProxyRoute('GET', 'issues/./comments', COMPANY_ID)).toBeNull();
    expect(matchProxyRoute('GET', 'heartbeat-runs/..', COMPANY_ID)).toBeNull();
  });

  it('rejects extra segments beyond known patterns', () => {
    expect(matchProxyRoute('GET', 'issues/abc/comments/c1/extra', COMPANY_ID)).toBeNull();
  });

  it('is case-insensitive on method', () => {
    const result = matchProxyRoute('get', 'companies/dashboard', COMPANY_ID);
    expect(result).toEqual({
      targetPath: `/api/companies/${COMPANY_ID}/dashboard`,
    });
  });

  it('rejects dynamic segments that are empty', () => {
    // "issues//comments" — the middle segment is empty
    expect(matchProxyRoute('GET', 'issues//comments', COMPANY_ID)).toBeNull();
  });
});
