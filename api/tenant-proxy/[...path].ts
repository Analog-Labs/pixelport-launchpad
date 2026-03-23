import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import {
  proxyToPaperclip,
  proxyToPaperclipAsBoard,
  ProxyTimeoutError,
} from '../lib/gateway';
import { matchProxyRoute } from '../lib/paperclip-proxy-allowlist';

function resolveProxyPath(req: VercelRequest): string {
  const pathParam = req.query.path;

  if (Array.isArray(pathParam)) {
    return pathParam.join('/');
  }

  if (typeof pathParam === 'string') {
    return pathParam;
  }

  // Fallback for environments that do not expose catch-all params reliably.
  const url = req.url ?? '';
  const pathname = url.split('?')[0] ?? '';
  const prefix = '/api/tenant-proxy/';
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length);
  }

  return '';
}

function resolveForwardedQueryString(req: VercelRequest): string {
  const rawUrl = req.url ?? '/';
  const parsed = new URL(rawUrl, 'https://pixelport.local');
  parsed.searchParams.delete('path');
  const query = parsed.searchParams.toString();
  return query ? `?${query}` : '';
}

function requiresBoardSession(method: string, proxyPath: string): boolean {
  if (method.toUpperCase() !== 'POST') {
    return false;
  }

  const normalizedPath = proxyPath.replace(/^\/+|\/+$/g, '');
  // Approval decision mutations require board auth
  if (/^approvals\/[^/]+\/(approve|reject|request-revision|resubmit)$/.test(normalizedPath)) {
    return true;
  }
  // Issue comment writes require board auth for active/checked-out issues
  if (/^issues\/[^/]+\/comments$/.test(normalizedPath)) {
    return true;
  }
  return false;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  try {
    // 1. Extract proxy path from catch-all param or query fallback.
    const proxyPath = resolveProxyPath(req);

    if (!proxyPath) {
      return res.status(400).json({ error: 'Missing proxy path' });
    }

    // 2. Authenticate dashboard user
    const { tenant, userId } = await authenticateRequest(req);

    // 3. Validate tenant has Paperclip infrastructure
    if (!tenant.droplet_ip) {
      return res.status(503).json({ error: 'Workspace is starting up' });
    }
    if (!tenant.paperclip_company_id || !tenant.paperclip_api_key) {
      return res.status(503).json({ error: 'Workspace not ready' });
    }

    // 4. Match against allowlist and rewrite path
    const method = (req.method || 'GET').toUpperCase();
    const match = matchProxyRoute(
      method,
      proxyPath,
      tenant.paperclip_company_id,
    );
    if (!match) {
      return res.status(404).json({ error: 'Route not found' });
    }

    // 5. Preserve query string from original request (excluding `path`).
    const queryString = resolveForwardedQueryString(req);
    const targetPath = match.targetPath + queryString;

    // 6. Forward to Paperclip
    const requestOptions = {
      method,
      body: ['POST', 'PATCH', 'PUT'].includes(method) ? req.body : undefined,
    };
    let response: Response;

    if (requiresBoardSession(method, proxyPath)) {
      try {
        response = await proxyToPaperclipAsBoard(tenant, userId, targetPath, requestOptions);
      } catch (error) {
        console.error(
          '[tenant-proxy] Board handoff failed, falling back to agent key proxy:',
          error,
        );
        response = await proxyToPaperclip(tenant, targetPath, requestOptions);
      }
      // If the response is 401/403, the auth method lacks approval permissions.
      // Return a clear error instead of the raw Paperclip response.
      if (response.status === 401 || response.status === 403) {
        return res.status(403).json({
          error: 'Approval action not authorized. The workspace may need to be re-provisioned.',
        });
      }
    } else {
      response = await proxyToPaperclip(tenant, targetPath, requestOptions);
    }

    // 7. Return Paperclip response to browser
    const body = await response.text();
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    return res.status(response.status).send(body);
  } catch (error) {
    if (error instanceof ProxyTimeoutError) {
      return res.status(504).json({ error: 'Workspace timeout' });
    }
    return errorResponse(res, error);
  }
}
