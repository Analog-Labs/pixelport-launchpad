import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { usePaperclipApprovals } from './usePaperclipApprovals';

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

describe('usePaperclipApprovals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ session: { access_token: 'tok-approvals' } });
  });

  it('fetches pending approvals with correct query params', async () => {
    const approval = {
      id: 'ap-1',
      type: 'social_post',
      content: 'Hello world',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ approvals: [approval] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipApprovals(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.approvals).toHaveLength(1);
    expect(result.current.data?.approvals[0].id).toBe('ap-1');

    // Verify the URL includes pending status filter
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=pending');
  });

  it('is disabled when no session token', async () => {
    useAuthMock.mockReturnValue({ session: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipApprovals(), { wrapper: wrapper(client) });

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces error on API failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: 'Server error' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => usePaperclipApprovals(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Server error');
  });
});
