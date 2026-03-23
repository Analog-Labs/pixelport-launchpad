/**
 * Integration test: Approval approve mutation.
 * Tests the full flow: render card → click Approve → POST to /approvals/:id/approve → toast.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import Approvals from './Approvals';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const pendingApproval = {
  id: 'ap-1',
  type: 'social_post',
  content: 'Check out our new feature at https://example.com',
  platform: 'X',
  createdBy: 'Chief of Staff',
  createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  status: 'pending',
  payload: { content: 'Check out our new feature' },
};

const payloadOnlyApproval = {
  id: 'ap-2',
  type: 'approve_ceo_strategy',
  content: '',
  createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  status: 'pending',
  payload: {
    title: 'Week 1 Strategy Checkpoint',
    summary: 'Initial strategy draft for Duolingo Growth Lab',
    requestedAction: 'Approve or request revisions before campaign execution.',
  },
};

describe('Approvals page — approve mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ session: { access_token: 'tok-approve' } });
  });

  it('renders pending approval and calls approve endpoint on click', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('companies/approvals')) {
        return Promise.resolve(makeResponse({ approvals: [pendingApproval] }));
      }
      if (String(url).includes('approvals/ap-1/approve')) {
        return Promise.resolve(makeResponse({}));
      }
      throw new Error(`Unhandled: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Approvals />
      </QueryClientProvider>,
    );

    // Wait for approval to appear
    await screen.findByText('Social Post');

    // Click Approve button
    const approveBtn = screen.getByRole('button', { name: /approve/i });
    fireEvent.click(approveBtn);

    // Should call approve endpoint
    await waitFor(() => {
      const approveCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('approvals/ap-1/approve'),
      );
      expect(approveCalls.length).toBeGreaterThanOrEqual(1);
      expect(approveCalls[0][1]?.method).toBe('POST');
    });
  });

  it('shows empty state when no approvals', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ approvals: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Approvals />
      </QueryClientProvider>,
    );

    await screen.findByText(/Inbox zero/i);
  });

  it('shows reject endpoint call on reject', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('companies/approvals')) {
        return Promise.resolve(makeResponse({ approvals: [pendingApproval] }));
      }
      if (String(url).includes('approvals/ap-1/reject')) {
        return Promise.resolve(makeResponse({}));
      }
      throw new Error(`Unhandled: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Approvals />
      </QueryClientProvider>,
    );

    await screen.findByText('Social Post');

    const rejectBtn = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      const rejectCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('approvals/ap-1/reject'),
      );
      expect(rejectCalls.length).toBeGreaterThanOrEqual(1);
      expect(rejectCalls[0][1]?.method).toBe('POST');
    });
  });

  it('renders payload summary when approval content is empty', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('companies/approvals')) {
        return Promise.resolve(makeResponse({ approvals: [payloadOnlyApproval] }));
      }
      throw new Error(`Unhandled: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Approvals />
      </QueryClientProvider>,
    );

    await screen.findByText('Week 1 Strategy Checkpoint');
    expect(
      screen.getByText(/Initial strategy draft for Duolingo Growth Lab/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Approve or request revisions before campaign execution/i)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Requested action:/i)).toBeInTheDocument();
  });
});
