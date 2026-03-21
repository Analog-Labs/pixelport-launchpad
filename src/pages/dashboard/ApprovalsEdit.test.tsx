/**
 * Integration test: 3-call inline edit flow.
 * ED-1: request-revision → resubmit → (optionally) approve
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
  id: 'edit-ap-1',
  type: 'social_post',
  content: 'Original content',
  platform: 'LinkedIn',
  createdBy: 'Chief',
  createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  status: 'pending',
  payload: { content: 'Original content', platform: 'linkedin' },
};

describe('Approval inline edit — 3-call flow (ED-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ session: { access_token: 'tok-edit' } });
  });

  it('Save Draft: calls request-revision then resubmit (no approve)', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body as string });
      if (String(url).includes('companies/approvals')) {
        return Promise.resolve(makeResponse({ approvals: [pendingApproval] }));
      }
      // All mutation endpoints return 200
      return Promise.resolve(makeResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Approvals />
      </QueryClientProvider>,
    );

    await screen.findByText('social_post');

    // Click Edit
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Textarea should appear
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Edited content here' } });

    // Click Save Draft
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      const mutationCalls = calls.filter((c) => c.method === 'POST');
      const revisionCall = mutationCalls.find((c) => c.url.includes('request-revision'));
      const resubmitCall = mutationCalls.find((c) => c.url.includes('resubmit'));
      const approveCall = mutationCalls.find((c) => c.url.includes('/approve'));

      expect(revisionCall).toBeDefined();
      expect(resubmitCall).toBeDefined();
      // Resubmit should contain edited content
      if (resubmitCall?.body) {
        const body = JSON.parse(resubmitCall.body) as { payload: { content: string } };
        expect(body.payload.content).toBe('Edited content here');
      }
      // Save Draft must NOT call approve
      expect(approveCall).toBeUndefined();
    });
  });

  it('Approve after edit: calls request-revision, resubmit, then approve', async () => {
    const calls: { url: string; method: string }[] = [];

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET' });
      if (String(url).includes('companies/approvals')) {
        return Promise.resolve(makeResponse({ approvals: [pendingApproval] }));
      }
      return Promise.resolve(makeResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Approvals />
      </QueryClientProvider>,
    );

    await screen.findByText('social_post');
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Improved version' } });

    // Click Approve (inside edit mode)
    const approveBtn = screen.getByRole('button', { name: /^approve$/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      const postCalls = calls.filter((c) => c.method === 'POST');
      const urls = postCalls.map((c) => c.url);

      expect(urls.some((u) => u.includes('request-revision'))).toBe(true);
      expect(urls.some((u) => u.includes('resubmit'))).toBe(true);
      expect(urls.some((u) => u.includes('/approve'))).toBe(true);
    });
  });
});
