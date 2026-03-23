import type { Tenant } from './auth';
import {
  buildPaperclipHandoffPayload,
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

function extractCookieHeader(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) {
    return null;
  }

  const match = setCookieHeader.match(/^\s*([^;]+)/);
  return match?.[1] ?? null;
}

async function establishPaperclipBoardSessionCookie(
  tenant: Tenant,
  userId: string,
): Promise<string> {
  if (!tenant.droplet_ip) {
    throw new Error('Tenant does not have a provisioned droplet');
  }

  const handoffConfig = resolvePaperclipHandoffConfig(process.env);
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

  const response = await fetch(handoffUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  });

  if (!response.ok && (response.status < 300 || response.status >= 400)) {
    const responseText = await response.text();
    throw new Error(
      `Paperclip handoff failed (${response.status}): ${responseText || 'No response body'}`,
    );
  }

  const cookieHeader = extractCookieHeader(response.headers.get('set-cookie'));
  if (!cookieHeader) {
    throw new Error('Paperclip handoff did not return a session cookie');
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

  return proxyToTenant(
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
}
