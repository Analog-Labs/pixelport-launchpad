/**
 * Integration test: Kanban drag-and-drop → PATCH /issues/:id
 *
 * Full DnD simulation in jsdom is unreliable (pointer events don't propagate
 * as in a real browser). We instead test the mutation directly by exercising
 * the useUpdateTaskStatus hook, which is the only path triggered by DnD.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { useUpdateTaskStatus } from '@/hooks/usePaperclipTasks';
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

describe('Kanban drag-and-drop → PATCH (useUpdateTaskStatus)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ session: { access_token: 'tok-kanban' } });
  });

  it('sends PATCH /issues/:id with new status', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('issues/task-1') && init?.method === 'PATCH') {
        return Promise.resolve(
          makeResponse({ id: 'task-1', title: 'Task', status: 'in_progress' }),
        );
      }
      // Handle any query refetch
      return Promise.resolve(makeResponse({ issues: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper: wrapper(client) });

    await act(async () => {
      result.current.mutate({ issueId: 'task-1', status: 'in_progress' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('issues/task-1') && init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body as string) as { status: string };
    expect(body.status).toBe('in_progress');
  });

  it('performs optimistic update before server responds', async () => {
    const initial: IssuesResponse = {
      issues: [{ id: 'task-2', title: 'My Task', status: 'backlog' }],
    };

    let resolveDelay!: () => void;
    const delayedPatch = new Promise<Response>((resolve) => {
      resolveDelay = () => resolve(makeResponse({ id: 'task-2', status: 'in_review' }));
    });

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('issues/task-2') && init?.method === 'PATCH') {
        return delayedPatch;
      }
      return Promise.resolve(makeResponse(initial));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Seed the cache
    client.setQueryData(['paperclip', 'issues'], initial);

    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper: wrapper(client) });

    act(() => {
      result.current.mutate({ issueId: 'task-2', status: 'in_review' });
    });

    // Cache should be updated optimistically before server resolves
    await waitFor(() => {
      const cached = client.getQueryData<IssuesResponse>(['paperclip', 'issues']);
      expect(cached?.issues[0].status).toBe('in_review');
    });

    // Resolve the patch
    resolveDelay();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('reverts optimistic update on PATCH failure', async () => {
    const initial: IssuesResponse = {
      issues: [{ id: 'task-3', title: 'Revert Me', status: 'backlog' }],
    };

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('issues/task-3') && init?.method === 'PATCH') {
        return Promise.resolve(makeResponse({ error: 'Server error' }, 500));
      }
      return Promise.resolve(makeResponse(initial));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['paperclip', 'issues'], initial);

    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper: wrapper(client) });

    await act(async () => {
      result.current.mutate({ issueId: 'task-3', status: 'done' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Cache should be reverted to backlog
    const cached = client.getQueryData<IssuesResponse>(['paperclip', 'issues']);
    expect(cached?.issues[0].status).toBe('backlog');
  });
});
