import type { Tenant } from './auth';

const GATEWAY_PORT = 18789;

export async function proxyToGateway(
  tenant: Tenant,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<unknown> {
  if (!tenant.droplet_ip) {
    throw new Error('Tenant does not have a provisioned droplet');
  }
  if (!tenant.gateway_token) {
    throw new Error('Tenant does not have a gateway token');
  }

  const url = `http://${tenant.droplet_ip}:${GATEWAY_PORT}${path}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${tenant.gateway_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway error (${response.status}): ${errorText}`);
  }

  return response.json();
}
