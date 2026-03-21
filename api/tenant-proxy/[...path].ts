import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';
import { proxyToPaperclip, ProxyTimeoutError } from '../lib/gateway';
import { matchProxyRoute } from '../lib/paperclip-proxy-allowlist';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  try {
    // 1. Extract proxy path from catch-all param
    const pathParam = req.query.path;
    const proxyPath = Array.isArray(pathParam)
      ? pathParam.join('/')
      : pathParam || '';

    if (!proxyPath) {
      return res.status(400).json({ error: 'Missing proxy path' });
    }

    // 2. Authenticate dashboard user
    const { tenant } = await authenticateRequest(req);

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

    // 5. Preserve query string from original request
    const qsIndex = req.url?.indexOf('?') ?? -1;
    const queryString = qsIndex >= 0 ? req.url!.slice(qsIndex) : '';
    const targetPath = match.targetPath + queryString;

    // 6. Forward to Paperclip
    const response = await proxyToPaperclip(tenant, targetPath, {
      method,
      body: ['POST', 'PATCH', 'PUT'].includes(method) ? req.body : undefined,
    });

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
