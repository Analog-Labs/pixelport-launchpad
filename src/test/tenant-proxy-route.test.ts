import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth module
const authenticateRequest = vi.fn();
const errorResponse = vi.fn(
  (res: MockResponse, error: unknown) =>
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }),
);

vi.mock('../../api/lib/auth', () => ({
  authenticateRequest,
  errorResponse,
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  },
}));

// Mock gateway module
const proxyToPaperclip = vi.fn();
const proxyToPaperclipAsBoard = vi.fn();

vi.mock('../../api/lib/gateway', () => ({
  proxyToPaperclip,
  proxyToPaperclipAsBoard,
  ProxyTimeoutError: class ProxyTimeoutError extends Error {
    constructor(target: string) {
      super(`Proxy timeout to ${target}`);
      this.name = 'ProxyTimeoutError';
    }
  },
}));

// Mock allowlist module
const matchProxyRoute = vi.fn();

vi.mock('../../api/lib/paperclip-proxy-allowlist', () => ({
  matchProxyRoute,
}));

type MockResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  send: (payload: unknown) => MockResponse;
  setHeader: (key: string, value: string) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };
}

function buildTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    slug: 'test-tenant',
    name: 'Test Tenant',
    status: 'active',
    plan: 'trial',
    droplet_ip: '10.0.0.1',
    gateway_token: 'gw-token',
    paperclip_company_id: 'company-abc',
    paperclip_api_key: 'pak-key-123',
    agent_api_key: 'ppk-key-456',
    ...overrides,
  };
}

function mockFetchResponse(status: number, body: string, contentType = 'application/json') {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(body),
    headers: new Map([['content-type', contentType]]),
  } as unknown as Response;
}

describe('GET/POST /api/tenant-proxy/[...path]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 400 for empty path', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    const req = { method: 'GET', query: { path: '' }, url: '/api/tenant-proxy/' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Missing proxy path' });
  });

  it('delegates auth errors to errorResponse', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    const authErr = new Error('Invalid token');
    authenticateRequest.mockRejectedValue(authErr);

    const req = { method: 'GET', query: { path: ['companies', 'dashboard'] }, url: '/api/tenant-proxy/companies/dashboard' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(errorResponse).toHaveBeenCalledWith(res, authErr);
  });

  it('returns 503 when tenant has no droplet_ip', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant({ droplet_ip: null }),
      userId: 'user-1',
    });

    const req = { method: 'GET', query: { path: ['companies', 'dashboard'] }, url: '/api/tenant-proxy/companies/dashboard' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Workspace is starting up' });
  });

  it('returns 503 when tenant has no paperclip_company_id', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant({ paperclip_company_id: null }),
      userId: 'user-1',
    });

    const req = { method: 'GET', query: { path: ['companies', 'dashboard'] }, url: '/api/tenant-proxy/companies/dashboard' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Workspace not ready' });
  });

  it('returns 503 when tenant has no paperclip_api_key', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant({ paperclip_api_key: null }),
      userId: 'user-1',
    });

    const req = { method: 'GET', query: { path: ['companies', 'dashboard'] }, url: '/api/tenant-proxy/companies/dashboard' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Workspace not ready' });
  });

  it('returns 404 when path is not in allowlist', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue(null);

    const req = { method: 'GET', query: { path: ['admin', 'config'] }, url: '/api/tenant-proxy/admin/config' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });

  it('forwards successful GET response from Paperclip', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/companies/company-abc/dashboard' });
    proxyToPaperclip.mockResolvedValue(
      mockFetchResponse(200, '{"agents":3,"tasks":12}'),
    );

    const req = { method: 'GET', query: { path: ['companies', 'dashboard'] }, url: '/api/tenant-proxy/companies/dashboard' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('{"agents":3,"tasks":12}');
    expect(proxyToPaperclip).toHaveBeenCalledWith(
      expect.objectContaining({ paperclip_company_id: 'company-abc' }),
      '/api/companies/company-abc/dashboard',
      { method: 'GET', body: undefined },
    );
  });

  it('forwards POST request body to Paperclip', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    // Use a non-board-session path (e.g. a generic POST) to test body forwarding
    matchProxyRoute.mockReturnValue({ targetPath: '/api/companies/company-abc/scan' });
    proxyToPaperclip.mockResolvedValue(
      mockFetchResponse(201, '{"id":"scan-1"}'),
    );

    const reqBody = { content: 'Hello agent' };
    const req = {
      method: 'POST',
      query: { path: ['companies', 'scan'] },
      url: '/api/tenant-proxy/companies/scan',
      body: reqBody,
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(201);
    expect(proxyToPaperclip).toHaveBeenCalledWith(
      expect.anything(),
      '/api/companies/company-abc/scan',
      { method: 'POST', body: reqBody },
    );
  });

  it('uses board session proxy for approval decision mutations', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/approvals/ap-1/approve' });
    proxyToPaperclipAsBoard.mockResolvedValue(
      mockFetchResponse(200, '{"status":"approved"}'),
    );

    const req = {
      method: 'POST',
      query: { path: ['approvals', 'ap-1', 'approve'] },
      url: '/api/tenant-proxy/approvals/ap-1/approve',
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(proxyToPaperclipAsBoard).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      '/api/approvals/ap-1/approve',
      { method: 'POST', body: {} },
    );
    expect(proxyToPaperclip).not.toHaveBeenCalled();
  });

  it('falls back to agent key proxy when board handoff throws', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/approvals/ap-1/reject' });
    proxyToPaperclipAsBoard.mockRejectedValue(new Error('Handoff timeout'));
    proxyToPaperclip.mockResolvedValue(
      mockFetchResponse(403, '{"error":"Forbidden"}'),
    );

    const req = {
      method: 'POST',
      query: { path: ['approvals', 'ap-1', 'reject'] },
      url: '/api/tenant-proxy/approvals/ap-1/reject',
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    // Board handoff failed, fell back to agent key proxy which returned 403
    // The handler should return a clear error instead of forwarding the raw 403
    expect(res.statusCode).toBe(403);
    expect(proxyToPaperclipAsBoard).toHaveBeenCalled();
    expect(proxyToPaperclip).toHaveBeenCalled();
    const body = res.body as { error: string };
    expect(body.error).toContain('not authorized');
  });

  it('uses board session proxy for issue comment writes', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/issues/task-1/comments' });
    proxyToPaperclipAsBoard.mockResolvedValue(
      mockFetchResponse(200, '{"id":"comment-1","body":"test"}'),
    );

    const req = {
      method: 'POST',
      query: { path: ['issues', 'task-1', 'comments'] },
      url: '/api/tenant-proxy/issues/task-1/comments',
      body: { body: 'test' },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(proxyToPaperclipAsBoard).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      '/api/issues/task-1/comments',
      { method: 'POST', body: { body: 'test' } },
    );
    expect(proxyToPaperclip).not.toHaveBeenCalled();
  });

  it('preserves query string in forwarded request', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/companies/company-abc/issues' });
    proxyToPaperclip.mockResolvedValue(
      mockFetchResponse(200, '[]'),
    );

    const req = {
      method: 'GET',
      query: { path: ['companies', 'issues'] },
      url: '/api/tenant-proxy/companies/issues?status=in_progress&assigneeAgentId=main',
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(proxyToPaperclip).toHaveBeenCalledWith(
      expect.anything(),
      '/api/companies/company-abc/issues?status=in_progress&assigneeAgentId=main',
      expect.anything(),
    );
  });

  it('supports query-style proxy path and excludes the path query from forwarded request', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/companies/company-abc/issues' });
    proxyToPaperclip.mockResolvedValue(
      mockFetchResponse(200, '[]'),
    );

    const req = {
      method: 'GET',
      query: { path: 'companies/issues', status: 'in_progress', limit: '20' },
      url: '/api/tenant-proxy?path=companies/issues&status=in_progress&limit=20',
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(matchProxyRoute).toHaveBeenCalledWith('GET', 'companies/issues', 'company-abc');
    expect(proxyToPaperclip).toHaveBeenCalledWith(
      expect.anything(),
      '/api/companies/company-abc/issues?status=in_progress&limit=20',
      expect.anything(),
    );
  });

  it('returns 504 on ProxyTimeoutError', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    const { ProxyTimeoutError } = await import('../../api/lib/gateway');

    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/companies/company-abc/dashboard' });
    proxyToPaperclip.mockRejectedValue(new ProxyTimeoutError('http://10.0.0.1:3100'));

    const req = { method: 'GET', query: { path: ['companies', 'dashboard'] }, url: '/api/tenant-proxy/companies/dashboard' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(504);
    expect(res.body).toEqual({ error: 'Workspace timeout' });
  });

  it('delegates network errors to errorResponse', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    const networkErr = new Error('fetch failed');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/companies/company-abc/dashboard' });
    proxyToPaperclip.mockRejectedValue(networkErr);

    const req = { method: 'GET', query: { path: ['companies', 'dashboard'] }, url: '/api/tenant-proxy/companies/dashboard' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(errorResponse).toHaveBeenCalledWith(res, networkErr);
  });

  it('forwards Paperclip 4xx/5xx responses as-is', async () => {
    const { default: handler } = await import('../../api/tenant-proxy/[...path]');
    authenticateRequest.mockResolvedValue({
      tenant: buildTenant(),
      userId: 'user-1',
    });
    matchProxyRoute.mockReturnValue({ targetPath: '/api/issues/bad-id' });
    proxyToPaperclip.mockResolvedValue(
      mockFetchResponse(404, '{"error":"Issue not found"}'),
    );

    const req = { method: 'GET', query: { path: ['issues', 'bad-id'] }, url: '/api/tenant-proxy/issues/bad-id' };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe('{"error":"Issue not found"}');
  });
});
