import type { Tenant } from './auth';
import {
  buildPaperclipHandoffPayload,
  PaperclipHandoffConfigError,
  resolvePaperclipHandoffConfig,
  signPaperclipHandoffPayload,
} from './paperclip-handoff-contract';

const GATEWAY_PORT = 18789;
const PAPERCLIP_PORT = 3100;
const PROXY_TIMEOUT_MS = 15_000;

export class ProxyTimeoutError extends Error {
  constructor(target: string) {
    super(`Proxy timeout after ${PROXY_TIMEOUT_MS}ms to ${target}`);
    this.name = 'ProxyTimeoutError';
  }
}

export type BoardSessionProxyErrorCode =
  | 'handoff_not_configured'
  | 'handoff_failed'
  | 'handoff_cookie_missing';

export class BoardSessionProxyError extends Error {
  code: BoardSessionProxyErrorCode;
  status: number | null;
  details: string | null;

  constructor(
    code: BoardSessionProxyErrorCode,
    message: string,
    options?: {
      status?: number | null;
      details?: string | null;
    },
  ) {
    super(message);
    this.name = 'BoardSessionProxyError';
    this.code = code;
    this.status = options?.status ?? null;
    this.details = options?.details ?? null;
  }
}

async function proxyToTenant(
  dropletIp: string,
  port: number,
  authToken: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const url = `http://${dropletIp}:${port}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  const trimmedAuthToken = authToken.trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (trimmedAuthToken) {
    headers.Authorization = `Bearer ${trimmedAuthToken}`;
  }

  try {
    return await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProxyTimeoutError(url);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxyToGateway(
  tenant: Tenant,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<unknown> {
  if (!tenant.droplet_ip) {
    throw new Error('Tenant does not have a provisioned droplet');
  }
  if (!tenant.gateway_token) {
    throw new Error('Tenant does not have a gateway token');
  }

  const response = await proxyToTenant(
    tenant.droplet_ip,
    GATEWAY_PORT,
    tenant.gateway_token,
    path,
    options,
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function proxyToPaperclip(
  tenant: Tenant,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  if (!tenant.droplet_ip) {
    throw new Error('Tenant does not have a provisioned droplet');
  }
  if (!tenant.paperclip_api_key) {
    throw new Error('Tenant does not have a Paperclip API key');
  }

  return proxyToTenant(
    tenant.droplet_ip,
    PAPERCLIP_PORT,
    tenant.paperclip_api_key,
    path,
    options,
  );
}

function splitCombinedSetCookieHeader(header: string): string[] {
  const values: string[] = [];
  let current = '';
  let inExpires = false;

  for (let i = 0; i < header.length; i += 1) {
    const char = header[i];
    const marker = header.slice(i, i + 8).toLowerCase();

    if (marker === 'expires=') {
      inExpires = true;
    }

    if (char === ';' && inExpires) {
      inExpires = false;
    }

    if (char === ',' && !inExpires) {
      if (current.trim().length > 0) {
        values.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    values.push(current.trim());
  }

  return values;
}

function extractCookieHeader(headers: Headers): string | null {
  const rawSetCookieHeaders: string[] = [];
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
    rawSetCookieHeaders.push(...headersWithGetSetCookie.getSetCookie());
  }

  const singleHeader = headers.get('set-cookie');
  if (singleHeader) {
    rawSetCookieHeaders.push(...splitCombinedSetCookieHeader(singleHeader));
  }

  const cookiePairs = rawSetCookieHeaders
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.match(/^\s*([^;]+)/)?.[1] ?? '')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (cookiePairs.length === 0) {
    return null;
  }

  // Browsers send Cookie as `k1=v1; k2=v2`.
  return cookiePairs.join('; ');
}

async function establishPaperclipBoardSessionCookie(
  tenant: Tenant,
  userId: string,
): Promise<string> {
  if (!tenant.droplet_ip) {
    throw new Error('Tenant does not have a provisioned droplet');
  }

  let handoffConfig;
  try {
    handoffConfig = resolvePaperclipHandoffConfig(process.env);
  } catch (error) {
    if (error instanceof PaperclipHandoffConfigError) {
      throw new BoardSessionProxyError(
        'handoff_not_configured',
        `Board handoff is not configured: ${error.fields.join(', ')}`,
      );
    }
    throw error;
  }

  const payload = buildPaperclipHandoffPayload({
    userId,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantStatus: tenant.status,
    tenantPlan: tenant.plan,
    source: 'tenant_proxy_mutation',
    ttlSeconds: handoffConfig.ttlSeconds,
  });
  const handoffToken = signPaperclipHandoffPayload(payload, handoffConfig.handoffSecret);
  const handoffUrl = `http://${tenant.droplet_ip}:${PAPERCLIP_PORT}/api/auth/pixelport/handoff?handoff_token=${encodeURIComponent(handoffToken)}&next=%2F`;
  const timeoutSignal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(PROXY_TIMEOUT_MS)
      : undefined;

  const response = await fetch(handoffUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: timeoutSignal,
  });

  if (!response.ok && (response.status < 300 || response.status >= 400)) {
    const responseText = await response.text();
    throw new BoardSessionProxyError(
      'handoff_failed',
      `Paperclip handoff failed (${response.status})`,
      {
        status: response.status,
        details: responseText || null,
      },
    );
  }

  const cookieHeader = extractCookieHeader(response.headers);
  if (!cookieHeader) {
    throw new BoardSessionProxyError(
      'handoff_cookie_missing',
      'Paperclip handoff did not return a session cookie',
      {
        status: response.status,
      },
    );
  }

  return cookieHeader;
}

export async function proxyToPaperclipAsBoard(
  tenant: Tenant,
  userId: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  if (!tenant.droplet_ip) {
    throw new Error('Tenant does not have a provisioned droplet');
  }

  const sessionCookie = await establishPaperclipBoardSessionCookie(tenant, userId);
  const origin = `http://${tenant.droplet_ip}:${PAPERCLIP_PORT}`;

  let response = await proxyToTenant(
    tenant.droplet_ip,
    PAPERCLIP_PORT,
    '',
    path,
    {
      ...options,
      headers: {
        Cookie: sessionCookie,
        Origin: origin,
        Referer: `${origin}/`,
        ...options.headers,
      },
    },
  );

  // Retry once with a fresh board handoff in case the first cookie was stale.
  if (response.status === 401 || response.status === 403) {
    const retryCookie = await establishPaperclipBoardSessionCookie(tenant, userId);
    if (retryCookie !== sessionCookie) {
      response = await proxyToTenant(
        tenant.droplet_ip,
        PAPERCLIP_PORT,
        '',
        path,
        {
          ...options,
          headers: {
            Cookie: retryCookie,
            Origin: origin,
            Referer: `${origin}/`,
            ...options.headers,
          },
        },
      );
    }
  }

  return response;
}
