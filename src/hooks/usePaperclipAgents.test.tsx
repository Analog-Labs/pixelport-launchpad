import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { usePaperclipAgents } from './usePaperclipAgents';

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

describe('usePaperclipAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ session: { access_token: 'tok-1' } });
  });

  it('fetches agents from companies/agents endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ agents: [{ id: 'a1', name: 'Chief', status: 'online' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipAgents(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.agents).toHaveLength(1);
    expect(result.current.data?.agents[0].id).toBe('a1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tenant-proxy/companies/agents',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
      }),
    );
  });

  it('is disabled when no session token is available', async () => {
    useAuthMock.mockReturnValue({ session: null });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipAgents(), { wrapper: wrapper(client) });

    // Query should not fire without token
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('transitions to error state on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: 'Not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipAgents(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
