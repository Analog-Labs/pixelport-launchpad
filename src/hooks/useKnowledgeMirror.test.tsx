import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { useKnowledgeMirror, KnowledgeConflictError } from './useKnowledgeMirror';

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}));

function jsonResponse(body: unknown, status = 200): Response {
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

const tenantFixture = {
  id: 'tenant-knowledge-1',
  name: 'Acme Labs',
  status: 'active',
  onboarding_data: {
    knowledge_mirror: {
      revision: 3,
      files: {
        'knowledge/company-overview.md': '# Company Overview\n\nAcme Labs',
        'knowledge/products-and-offers.md': '# Products and Offers\n\nStarter',
        'knowledge/audience-and-icp.md': '# Audience and ICP\n\nB2B founders',
        'knowledge/brand-voice.md': '# Brand Voice\n\nClear and direct',
        'knowledge/competitors.md': '# Competitors\n\nCompetitor A',
      },
      sync: {
        status: 'pending',
        synced_revision: 2,
        seeded_revision: 1,
        last_synced_at: null,
        last_error: null,
        updated_at: '2026-03-27T05:00:00.000Z',
      },
    },
  },
};

describe('useKnowledgeMirror', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('polls while sync is pending and stops once status becomes synced', async () => {
    vi.useFakeTimers();

    const refreshTenantMock = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      session: { access_token: 'token-knowledge' },
      tenant: tenantFixture,
      tenantLoading: false,
      refreshTenant: refreshTenantMock,
    });

    let statusCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/tenants/status') {
        statusCallCount += 1;
        const statusPayload =
          statusCallCount === 1
            ? {
                knowledge_sync: {
                  status: 'pending',
                  revision: 3,
                  synced_revision: 2,
                  seeded_revision: 1,
                  last_synced_at: null,
                  last_error: null,
                  updated_at: '2026-03-27T05:00:00.000Z',
                },
              }
            : {
                knowledge_sync: {
                  status: 'synced',
                  revision: 3,
                  synced_revision: 3,
                  seeded_revision: 1,
                  last_synced_at: '2026-03-27T05:01:00.000Z',
                  last_error: null,
                  updated_at: '2026-03-27T05:01:00.000Z',
                },
              };
        return Promise.resolve(jsonResponse(statusPayload));
      }

      throw new Error(`Unexpected fetch URL in polling test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useKnowledgeMirror(), { wrapper: wrapper(client) });

    expect(result.current.syncSummary.status).toBe('pending');
    expect(statusCallCount).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.syncSummary.status).toBe('synced');
    const callsAfterSynced = statusCallCount;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(statusCallCount).toBe(callsAfterSynced);
    expect(refreshTenantMock).not.toHaveBeenCalled();
  });

  it('sends expected_revision when saving a section and refreshes tenant/status on success', async () => {
    const refreshTenantMock = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      session: { access_token: 'token-knowledge' },
      tenant: tenantFixture,
      tenantLoading: false,
      refreshTenant: refreshTenantMock,
    });

    let onboardingBody: Record<string, unknown> | null = null;
    let statusCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/tenants/status') {
        statusCalls += 1;
        return Promise.resolve(
          jsonResponse({
            knowledge_sync: {
              status: 'synced',
              revision: 4,
              synced_revision: 4,
              seeded_revision: 1,
              last_synced_at: '2026-03-27T05:02:00.000Z',
              last_error: null,
              updated_at: '2026-03-27T05:02:00.000Z',
            },
          }),
        );
      }

      if (url === '/api/tenants/onboarding') {
        onboardingBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return Promise.resolve(
          jsonResponse({
            success: true,
            knowledge_sync: {
              queued: true,
              revision: 4,
            },
          }),
        );
      }

      throw new Error(`Unexpected fetch URL in save test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useKnowledgeMirror(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));

    await act(async () => {
      await result.current.saveSection({
        fileKey: 'knowledge/company-overview.md',
        content: '# Company Overview\n\nUpdated context',
        expectedRevision: 3,
      });
    });

    expect(onboardingBody).toEqual({
      knowledge_mirror_expected_revision: 3,
      knowledge_mirror: {
        files: {
          'knowledge/company-overview.md': '# Company Overview\n\nUpdated context',
        },
      },
    });
    expect(refreshTenantMock).toHaveBeenCalledOnce();
    expect(statusCalls).toBeGreaterThanOrEqual(2);
  });

  it('throws KnowledgeConflictError on 409 conflict responses', async () => {
    useAuthMock.mockReturnValue({
      session: { access_token: 'token-knowledge' },
      tenant: tenantFixture,
      tenantLoading: false,
      refreshTenant: vi.fn().mockResolvedValue(undefined),
    });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/tenants/status') {
        return Promise.resolve(
          jsonResponse({
            knowledge_sync: {
              status: 'synced',
              revision: 3,
              synced_revision: 3,
              seeded_revision: 1,
              last_synced_at: '2026-03-27T05:02:00.000Z',
              last_error: null,
              updated_at: '2026-03-27T05:02:00.000Z',
            },
          }),
        );
      }

      if (url === '/api/tenants/onboarding') {
        return Promise.resolve(
          jsonResponse(
            {
              error: 'Knowledge mirror conflict. Refresh data and retry your save.',
              expected_revision: 3,
              current_revision: 4,
            },
            409,
          ),
        );
      }

      throw new Error(`Unexpected fetch URL in conflict test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useKnowledgeMirror(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));

    await expect(
      result.current.saveSection({
        fileKey: 'knowledge/company-overview.md',
        content: '# Company Overview\n\nConflict content',
        expectedRevision: 3,
      }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);
  });

  it('sends force_knowledge_sync retry payload without requiring file edits', async () => {
    const refreshTenantMock = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      session: { access_token: 'token-knowledge' },
      tenant: tenantFixture,
      tenantLoading: false,
      refreshTenant: refreshTenantMock,
    });

    let retryBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/tenants/status') {
        return Promise.resolve(
          jsonResponse({
            knowledge_sync: {
              status: 'failed',
              revision: 3,
              synced_revision: 2,
              seeded_revision: 1,
              last_synced_at: null,
              last_error: 'Runtime unavailable',
              updated_at: '2026-03-27T05:04:00.000Z',
            },
          }),
        );
      }

      if (url === '/api/tenants/onboarding') {
        retryBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return Promise.resolve(
          jsonResponse({
            success: true,
            knowledge_sync: {
              queued: true,
              revision: 3,
            },
          }),
        );
      }

      throw new Error(`Unexpected fetch URL in retry test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useKnowledgeMirror(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));

    await act(async () => {
      await result.current.retrySync(3);
    });

    expect(retryBody).toEqual({
      force_knowledge_sync: true,
      knowledge_mirror_expected_revision: 3,
    });
    expect(refreshTenantMock).toHaveBeenCalledOnce();
  });
});
