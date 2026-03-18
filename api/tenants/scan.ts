import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isIP } from 'net';
import { lookup } from 'dns/promises';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BLOCKED_HOSTNAMES = new Set(['localhost']);
const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal'];
const MAX_HTML_BYTES = 200_000;
const MAX_TEXT_CHARS = 5_000;
const REDIRECT_LIMIT = 5;

type ExtractedData = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  bodyText: string;
  fetchError: string | null;
  finalUrl: string;
};

function getBearerToken(req: VercelRequest): string | null {
  const auth = req.headers.authorization;
  const value = Array.isArray(auth) ? auth[0] : auth;
  if (!value || !value.startsWith('Bearer ')) return null;
  return value.slice(7);
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map((p) => Number.parseInt(p, 10));
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fe80:')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
  }

  return false;
}

async function assertSafePublicTarget(url: URL): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid URL protocol');
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new Error('Blocked host target');
  }

  if (isIP(host) && isBlockedIp(host)) {
    throw new Error('Blocked IP target');
  }

  try {
    const results = await lookup(host, { all: true, verbatim: true });
    if (results.length === 0) {
      throw new Error('No address records found');
    }
    if (results.some((result) => isBlockedIp(result.address))) {
      throw new Error('Resolved to private/internal IP');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Resolved to private/internal IP')) {
      throw error;
    }
    throw new Error('Host resolution failed');
  }
}

function parseMetadata(html: string): Omit<ExtractedData, 'fetchError' | 'finalUrl'> {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i);
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)/i);
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)/i);
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)/i);

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1] : html;
  const bodyText = rawBody
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);

  return {
    title: titleMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || '',
    ogTitle: ogTitleMatch?.[1]?.trim() || '',
    ogDescription: ogDescMatch?.[1]?.trim() || '',
    ogImage: ogImageMatch?.[1]?.trim() || '',
    bodyText,
  };
}

async function fetchAndExtract(inputUrl: URL): Promise<ExtractedData> {
  try {
    let current = inputUrl;

    for (let attempt = 0; attempt <= REDIRECT_LIMIT; attempt += 1) {
      await assertSafePublicTarget(current);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(current.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PixelPort-Scanner/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
      });
      clearTimeout(timeout);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            title: '',
            description: '',
            ogTitle: '',
            ogDescription: '',
            ogImage: '',
            bodyText: '',
            fetchError: `Redirect without location (HTTP ${response.status})`,
            finalUrl: current.toString(),
          };
        }
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) {
        return {
          title: '',
          description: '',
          ogTitle: '',
          ogDescription: '',
          ogImage: '',
          bodyText: '',
          fetchError: `HTTP ${response.status}`,
          finalUrl: current.toString(),
        };
      }

      const contentType = response.headers.get('content-type') || '';
      const payload = (await response.text()).slice(0, MAX_HTML_BYTES);
      const parsed = parseMetadata(payload);

      return {
        ...parsed,
        fetchError: contentType.includes('html') ? null : `Non-HTML content-type: ${contentType || 'unknown'}`,
        finalUrl: current.toString(),
      };
    }

    return {
      title: '',
      description: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      bodyText: '',
      fetchError: `Too many redirects (>${REDIRECT_LIMIT})`,
      finalUrl: inputUrl.toString(),
    };
  } catch (error) {
    return {
      title: '',
      description: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      bodyText: '',
      fetchError: error instanceof Error ? error.message : 'Website fetch failed',
      finalUrl: inputUrl.toString(),
    };
  }
}

async function generateBrandProfile(input: {
  url: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  bodyText: string;
}): Promise<Record<string, unknown>> {
  const prompt = `Analyze this website content and extract a structured brand profile.

Website URL: ${input.url}
Page Title: ${input.title || input.ogTitle || 'Not found'}
Meta Description: ${input.description || input.ogDescription || 'Not found'}

Page Content (truncated):
${input.bodyText || 'No body content extracted.'}

Return only a valid JSON object with:
- company_description (string|null)
- value_proposition (string|null)
- target_audience (string|null)
- brand_voice (string|null)
- key_products (string[]|null)
- industry (string|null)`;

  const noLlmConfigured = !OPENAI_API_KEY && !GEMINI_API_KEY;
  if (noLlmConfigured) {
    return { error: 'No scan LLM provider is configured' };
  }

  const providerErrors: string[] = [];

  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You extract structured brand profiles. Return only JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        providerErrors.push(`openai_http_${response.status}`);
      } else {
        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          providerErrors.push('openai_empty_content');
        } else {
          return JSON.parse(content) as Record<string, unknown>;
        }
      }
    } catch (error) {
      providerErrors.push(error instanceof Error ? `openai_exception:${error.message}` : 'openai_exception');
    }
  }

  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        providerErrors.push(`gemini_http_${response.status}`);
      } else {
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
          providerErrors.push('gemini_empty_content');
        } else {
          return JSON.parse(content) as Record<string, unknown>;
        }
      }
    } catch (error) {
      providerErrors.push(error instanceof Error ? `gemini_exception:${error.message}` : 'gemini_exception');
    }
  }

  return {
    error: 'LLM processing failed',
    provider_errors: providerErrors,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!SUPABASE_PROJECT_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase environment is not configured' });
    }

    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const body = (req.body || {}) as { company_url?: string };
    if (!body.company_url || typeof body.company_url !== 'string') {
      return res.status(400).json({ error: 'company_url is required' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizeUrl(body.company_url));
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL — must be http or https' });
    }

    const extracted = await fetchAndExtract(parsedUrl);
    const brandProfile = await generateBrandProfile({
      url: extracted.finalUrl,
      title: extracted.title,
      description: extracted.description,
      ogTitle: extracted.ogTitle,
      ogDescription: extracted.ogDescription,
      bodyText: extracted.bodyText,
    });

    return res.status(200).json({
      scan_results: {
        ...brandProfile,
        metadata: {
          title: extracted.title || extracted.ogTitle || null,
          description: extracted.description || extracted.ogDescription || null,
          og_image: extracted.ogImage || null,
        },
        scanned_url: extracted.finalUrl,
        scanned_at: new Date().toISOString(),
        fetch_error: extracted.fetchError,
      },
    });
  } catch (error) {
    console.error('Website scan failed', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
