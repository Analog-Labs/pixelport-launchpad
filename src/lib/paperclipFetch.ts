/**
 * Shared fetch helper for all Paperclip proxy calls.
 * Handles URL construction, auth headers, response parsing, and error logging.
 *
 * ED-3: All usePaperclip* hooks share this helper.
 */

export class PaperclipFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'PaperclipFetchError';
  }
}

/**
 * Fetch a Paperclip resource via the Vercel proxy.
 *
 * @param path  Path after /api/tenant-proxy/ (may include query string)
 * @param options  Additional fetch options (method, body, etc.)
 * @param token  Supabase session access token
 */
export async function paperclipFetch<T>(
  path: string,
  options: RequestInit = {},
  token: string,
): Promise<T> {
  const url = `/api/tenant-proxy/${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Paperclip proxy error: ${response.status}`;
    try {
      const body = await response.json() as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // ignore JSON parse errors
    }
    console.error(`[paperclipFetch] ${path} → ${response.status}: ${message}`);
    throw new PaperclipFetchError(message, response.status, path);
  }

  // 204 No Content and other empty responses have no JSON body — return undefined
  // rather than letting .json() throw a SyntaxError on an empty stream.
  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status === 204 || contentLength === '0' || !contentType.includes('application/json')) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
