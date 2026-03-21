import type { Tenant } from './auth';

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

  try {
    return await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
