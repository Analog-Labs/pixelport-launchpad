import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paperclipFetch, PaperclipFetchError } from './paperclipFetch';

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('paperclipFetch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('constructs the correct URL with /api/tenant-proxy/ prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await paperclipFetch('companies/dashboard', {}, 'token-123');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tenant-proxy/companies/dashboard',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    );
  });

  it('includes Content-Type and Authorization headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ data: true }));
    vi.stubGlobal('fetch', fetchMock);

    await paperclipFetch('companies/agents', {}, 'my-token');

    const callArgs = fetchMock.mock.calls[0][1];
    expect(callArgs.headers['Content-Type']).toBe('application/json');
    expect(callArgs.headers['Authorization']).toBe('Bearer my-token');
  });

  it('returns parsed JSON on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ agents: [{ id: 'a1' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await paperclipFetch<{ agents: { id: string }[] }>('companies/agents', {}, 'tok');
    expect(result).toEqual({ agents: [{ id: 'a1' }] });
  });

  it('throws PaperclipFetchError on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: 'Not Found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      paperclipFetch('companies/agents', {}, 'tok'),
    ).rejects.toBeInstanceOf(PaperclipFetchError);
  });

  it('includes status code and path in PaperclipFetchError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: 'Unauthorized' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    let caught: PaperclipFetchError | undefined;
    try {
      await paperclipFetch('companies/approvals', {}, 'bad-token');
    } catch (e) {
      caught = e as PaperclipFetchError;
    }

    expect(caught?.status).toBe(401);
    expect(caught?.path).toBe('companies/approvals');
  });

  it('passes through additional fetch options (method, body)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await paperclipFetch(
      'approvals/abc/approve',
      { method: 'POST', body: JSON.stringify({ note: 'ok' }) },
      'tok',
    );

    const callArgs = fetchMock.mock.calls[0][1];
    expect(callArgs.method).toBe('POST');
    expect(callArgs.body).toBe(JSON.stringify({ note: 'ok' }));
  });
});
