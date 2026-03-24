import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useAssignTask,
  useCreateTask,
  usePaperclipTasks,
  useUpdateTaskPriority,
} from '@/hooks/usePaperclipTasks';
import { usePaperclipAgentRuns } from '@/hooks/usePaperclipAgents';
import { usePaperclipActivity } from '@/hooks/usePaperclipActivity';
import { usePaperclipCostsByAgent } from '@/hooks/usePaperclipCosts';
import { usePaperclipAgentDetail, usePaperclipAgentIssues, useWakeAgent } from '@/hooks/usePaperclipAgentDetail';
import type { IssuesResponse } from '@/lib/paperclip-types';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: useAuthMock }));

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('T4 paperclip hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ session: { access_token: 'tok-t4' } });
  });

  it('useCreateTask posts to companies/issues', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('companies/issues') && init?.method === 'POST') {
        return Promise.resolve(makeResponse({ id: 'issue-1', title: 'Ship T4', status: 'todo' }));
      }
      return Promise.resolve(makeResponse({ issues: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCreateTask(), { wrapper: wrapper(client) });

    await act(async () => {
      result.current.mutate({ title: 'Ship T4', priority: 'high' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('companies/issues') && init?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall![1].body as string)).toMatchObject({
      title: 'Ship T4',
      priority: 'high',
    });
  });

  it('useAssignTask rolls back on failure', async () => {
    const initial: IssuesResponse = {
      issues: [{ id: 'issue-2', title: 'Assign me', status: 'todo', assigneeAgentId: 'a-old' }],
    };

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('issues/issue-2') && init?.method === 'PATCH') {
        return Promise.resolve(makeResponse({ error: 'failed' }, 500));
      }
      return Promise.resolve(makeResponse(initial));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['paperclip', 'issues', {}], initial);

    const { result } = renderHook(() => useAssignTask(), { wrapper: wrapper(client) });

    await act(async () => {
      result.current.mutate({ issueId: 'issue-2', assigneeAgentId: 'a-new' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const restored = client.getQueryData<IssuesResponse>(['paperclip', 'issues', {}]);
    expect(restored?.issues[0].assigneeAgentId).toBe('a-old');
  });

  it('useUpdateTaskPriority patches issue priority', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('issues/issue-3') && init?.method === 'PATCH') {
        return Promise.resolve(makeResponse({ id: 'issue-3', title: 'P', status: 'todo', priority: 'critical' }));
      }
      return Promise.resolve(makeResponse({ issues: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUpdateTaskPriority(), { wrapper: wrapper(client) });

    await act(async () => {
      result.current.mutate({ issueId: 'issue-3', priority: 'critical' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('issues/issue-3') && init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall![1].body as string)).toEqual({ priority: 'critical' });
  });

  it('useWakeAgent posts wakeup with empty object body', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('agents/agent-1/wakeup')) {
        return Promise.resolve(makeResponse({ ok: true }));
      }
      return Promise.resolve(makeResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useWakeAgent(), { wrapper: wrapper(client) });

    await act(async () => {
      result.current.mutate({ agentId: 'agent-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const wakeCall = fetchMock.mock.calls.find(([url]) => String(url).includes('agents/agent-1/wakeup'));
    expect(wakeCall).toBeDefined();
    expect(JSON.parse(wakeCall![1].body as string)).toEqual({});
  });

  it('usePaperclipAgentIssues fetches assignee-scoped issues', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ issues: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipAgentIssues('agent-2'), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tenant-proxy/companies/issues?assigneeAgentId=agent-2',
      expect.anything(),
    );
  });

  it('usePaperclipActivity normalizes empty list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ activity: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipActivity(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.entries).toEqual([]);
  });

  it('usePaperclipActivity falls back to empty list on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: 'Route not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipActivity(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.entries).toEqual([]);
  });

  it('usePaperclipCostsByAgent normalizes empty list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ costs: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipCostsByAgent(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.agents).toEqual([]);
  });

  it('usePaperclipCostsByAgent falls back to empty list on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: 'Route not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipCostsByAgent(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.agents).toEqual([]);
  });

  it('usePaperclipAgentDetail falls back to placeholder on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: 'Route not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipAgentDetail('agent-404'), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      id: 'agent-404',
      name: 'Agent',
      status: 'offline',
    });
  });

  it('usePaperclipTasks falls back when unreadForUserId=me is rejected', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('unreadForUserId=me')) {
        return Promise.resolve(makeResponse({ error: 'requires board auth' }, 403));
      }
      if (String(url).includes('/api/tenant-proxy/companies/issues')) {
        return Promise.resolve(
          makeResponse({
            issues: [{ id: 'issue-7', title: 'Fallback task', status: 'todo' }],
          }),
        );
      }
      return Promise.resolve(makeResponse({ issues: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipTasks({ unreadForUserId: 'me' }), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.issues.map((issue) => issue.id)).toEqual(['issue-7']);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('unreadForUserId=me'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/tenant-proxy/companies/issues'))).toBe(true);
  });

  it('usePaperclipTasks respects enabled=false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ issues: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipTasks({ enabled: false }), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usePaperclipAgentRuns isolates cache by limit in query key', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('limit=1')) {
        return Promise.resolve(makeResponse({ runs: [{ id: 'run-1', status: 'running', startedAt: '2026-03-20T00:00:00Z' }] }));
      }
      if (String(url).includes('limit=3')) {
        return Promise.resolve(makeResponse({ runs: [{ id: 'run-3', status: 'running', startedAt: '2026-03-20T00:00:00Z' }] }));
      }
      return Promise.resolve(makeResponse({ runs: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const first = renderHook(() => usePaperclipAgentRuns('agent-3', 1), { wrapper: wrapper(client) });
    const second = renderHook(() => usePaperclipAgentRuns('agent-3', 3), { wrapper: wrapper(client) });

    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(first.result.current.data?.runs[0].id).toBe('run-1');
    expect(second.result.current.data?.runs[0].id).toBe('run-3');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('limit=1'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('limit=3'))).toBe(true);
  });
});
