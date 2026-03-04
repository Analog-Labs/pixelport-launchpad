# Codex Slice 8 — Website Auto-Scan API

**Priority:** 🟢 Zero blockers — ready to execute immediately
**Assigned to:** Codex
**Depends on:** Slice 5 (tenant must exist for auth)
**Estimated time:** 2-3 hours

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets a visible AI agent (customizable name/avatar/tone) with invisible sub-agents behind the scenes.

**Where does this slice fit?** During onboarding (Step 1), the customer enters their company URL. The frontend shows "Scanning your website..." while this endpoint fetches the page, extracts brand information using an LLM, and returns a structured brand profile. The results are stored in `onboarding_data.scan_results` and later injected into the agent's SOUL.md during provisioning.

**How this connects to other slices:**
- The frontend onboarding widget (Founder Track) calls this endpoint after the user enters their URL
- Slice 5 (`POST /api/tenants`) includes `scan_results` in `onboarding_data` when creating the tenant
- The provisioning workflow (Slice 4) reads `scan_results` to populate SOUL.md

---

## Repository Access

- **Repo:** https://github.com/Analog-Labs/pixelport-launchpad
- **Branch:** Work on `main`
- Read `CLAUDE.md` first, then `docs/phase1/cto-phase1-go-package-v2.md` for critical Vercel patterns
- After completing work: update SESSION-LOG.md, commit and push

---

## ⚠️ CRITICAL: Vercel Serverless Patterns

These patterns were discovered through painful debugging. Violating any will crash your endpoints:

1. **ESM/CommonJS:** `api/package.json` exists with `{"type": "commonjs"}`. Do NOT delete it.
2. **Inngest Client:** If you need to send Inngest events, create the client INLINE. Do NOT import from `../inngest/client`.
3. **Shared Libs:** `api/lib/auth.ts` and `api/lib/supabase.ts` are safe — they only import from npm packages.
4. **After Deploy:** Run `curl -X PUT https://pixelport-launchpad.vercel.app/api/inngest` to sync Inngest functions.

---

## What You're Building

### 1. Website Auto-Scan Endpoint

**File: `api/tenants/scan.ts`** (NEW)

```typescript
/**
 * POST /api/tenants/scan — Scan a company website and extract brand profile
 *
 * Called by the frontend onboarding widget after the user enters their company URL.
 * Fetches the homepage, extracts text content + metadata, and uses LLM to generate
 * a structured brand profile.
 *
 * The scan_results are stored by the frontend and included in the POST /api/tenants
 * payload so the provisioning workflow can inject them into SOUL.md.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, errorResponse } from '../lib/auth';

const LITELLM_URL = process.env.LITELLM_URL;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY;

/**
 * Fetch a URL and extract text content + metadata.
 * Strips HTML tags, truncates to maxChars.
 */
async function fetchAndExtract(url: string, maxChars = 5000): Promise<{
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  bodyText: string;
  fetchError: string | null;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PixelPort-Scanner/1.0 (brand profile extraction)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        title: '', description: '', ogTitle: '', ogDescription: '', ogImage: '',
        bodyText: '', fetchError: `HTTP ${response.status}`,
      };
    }

    // Limit response size to ~200KB
    const text = await response.text();
    const html = text.slice(0, 200_000);

    // Extract metadata from <head>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)/i);
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)/i);

    // Strip HTML tags and extract body text
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const rawBody = bodyMatch ? bodyMatch[1] : html;
    const bodyText = rawBody
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);

    return {
      title: titleMatch?.[1]?.trim() || '',
      description: descMatch?.[1]?.trim() || '',
      ogTitle: ogTitleMatch?.[1]?.trim() || '',
      ogDescription: ogDescMatch?.[1]?.trim() || '',
      ogImage: ogImageMatch?.[1]?.trim() || '',
      bodyText,
      fetchError: null,
    };
  } catch (error) {
    return {
      title: '', description: '', ogTitle: '', ogDescription: '', ogImage: '',
      bodyText: '',
      fetchError: error instanceof Error ? error.message : 'Fetch failed',
    };
  }
}

/**
 * Call LiteLLM to generate a structured brand profile from extracted content.
 */
async function generateBrandProfile(extracted: {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  bodyText: string;
  url: string;
}): Promise<Record<string, unknown>> {
  if (!LITELLM_URL || !LITELLM_MASTER_KEY) {
    return { error: 'LiteLLM not configured' };
  }

  const prompt = `Analyze this website content and extract a structured brand profile.

Website URL: ${extracted.url}
Page Title: ${extracted.title || extracted.ogTitle || 'Not found'}
Meta Description: ${extracted.description || extracted.ogDescription || 'Not found'}

Page Content (truncated):
${extracted.bodyText || 'No content extracted — the site may require JavaScript rendering.'}

Return a JSON object with these fields:
- company_description: 1-2 sentence description of what the company does
- value_proposition: Their main value proposition or tagline
- target_audience: Who their ideal customers are
- brand_voice: The tone/style of their communication (e.g., "professional and authoritative", "casual and friendly", "bold and innovative")
- key_products: Array of their main products/services (max 5)
- industry: The industry they operate in

If information is not available, use null for that field. Return ONLY valid JSON, no markdown.`;

  try {
    const response = await fetch(`${LITELLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LITELLM_MASTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a brand analysis expert. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('LiteLLM scan error:', response.status);
      return { error: `LLM call failed: HTTP ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { error: 'Empty LLM response' };
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Brand profile generation error:', error);
    return { error: error instanceof Error ? error.message : 'LLM call failed' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate (user must be logged in, but tenant doesn't need to exist yet)
    // Use supabase.auth.getUser directly since tenant may not exist during onboarding
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_PROJECT_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const token = Array.isArray(authHeader) ? authHeader[0].slice(7) : authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Validate request body
    const { company_url } = req.body || {};

    if (!company_url || typeof company_url !== 'string') {
      return res.status(400).json({ error: 'company_url is required' });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(company_url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL — must be http or https' });
    }

    // Fetch and extract content
    const extracted = await fetchAndExtract(parsedUrl.toString());

    // Generate brand profile via LLM
    const brandProfile = await generateBrandProfile({
      ...extracted,
      url: parsedUrl.toString(),
    });

    return res.status(200).json({
      scan_results: {
        ...brandProfile,
        metadata: {
          title: extracted.title || extracted.ogTitle,
          description: extracted.description || extracted.ogDescription,
          og_image: extracted.ogImage,
        },
        scanned_url: parsedUrl.toString(),
        scanned_at: new Date().toISOString(),
        fetch_error: extracted.fetchError,
      },
    });
  } catch (error) {
    console.error('Scan error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 2. Enrich SOUL.md Template

**File: `api/inngest/functions/provision-tenant.ts`** (MODIFY)

Update the `buildSoulTemplate` function to include scan results:

**Find this function** (currently at ~line 532):
```typescript
function buildSoulTemplate(params: { tenantName: string; onboardingData: Json }): string {
```

**Replace with:**
```typescript
function buildSoulTemplate(params: { tenantName: string; onboardingData: Json }): string {
  const agentName = (params.onboardingData.agent_name as string) || 'Luna';
  const agentTone = (params.onboardingData.agent_tone as string) || 'professional';
  const scanResults = params.onboardingData.scan_results as Record<string, unknown> | undefined;

  // Build brand context from scan results
  let brandContext = '';
  if (scanResults && !scanResults.error) {
    const parts: string[] = [];
    if (scanResults.company_description) parts.push(`**About:** ${scanResults.company_description}`);
    if (scanResults.value_proposition) parts.push(`**Value Prop:** ${scanResults.value_proposition}`);
    if (scanResults.target_audience) parts.push(`**Target Audience:** ${scanResults.target_audience}`);
    if (scanResults.brand_voice) parts.push(`**Brand Voice:** ${scanResults.brand_voice}`);
    if (scanResults.industry) parts.push(`**Industry:** ${scanResults.industry}`);
    if (Array.isArray(scanResults.key_products) && scanResults.key_products.length > 0) {
      parts.push(`**Key Products/Services:** ${scanResults.key_products.join(', ')}`);
    }
    brandContext = parts.join('\n');
  }

  // Map tone selection to personality description
  const toneMap: Record<string, string> = {
    casual: 'Friendly, conversational, uses emojis occasionally. Like a smart colleague you grab coffee with.',
    professional: 'Professional but approachable. Clear, concise, confident. Avoids jargon unless the team uses it.',
    bold: 'Direct, energetic, opinionated. Pushes for ambitious goals. Not afraid to challenge assumptions.',
  };
  const personalityDesc = toneMap[agentTone] || toneMap.professional;

  return `# ${agentName} — AI Chief of Staff for ${params.tenantName}

## Identity
You are ${agentName}, the AI Chief of Staff for ${params.tenantName}. You coordinate marketing operations, manage content production, monitor competitors, and report results.

## Personality & Tone
${personalityDesc}

## Your Team
- **You (${agentName})**: The only agent the human interacts with. You orchestrate everything.
- **Spark** (invisible): Your content creation specialist.
- **Scout** (invisible): Your research and intelligence analyst.

## Knowledge Base
${brandContext || 'No website scan results available. Ask the human about their company, products, and target audience.'}

## Core Responsibilities
1. Daily/weekly marketing reporting
2. Content creation orchestration (delegate to Spark)
3. Competitor monitoring (delegate to Scout)
4. Proactive suggestions and strategy
5. Respond to human requests promptly

## Operating Rules
- You are the ONLY interface to the human. Spark and Scout work behind the scenes.
- Always present content for human approval before publishing.
- Be proactive — do not just wait for instructions.
- Keep the human informed of important developments.
`;
}
```

---

## Environment Variables

All required env vars are already set in Vercel:

| Variable | Status | Used By |
|----------|--------|---------|
| SUPABASE_PROJECT_URL | ✅ SET | Auth |
| SUPABASE_SERVICE_ROLE_KEY | ✅ SET | Auth |
| LITELLM_URL | ✅ SET | LLM call for brand extraction |
| LITELLM_MASTER_KEY | ✅ SET | LLM auth |

No new env vars needed for this slice.

---

## API Contract

### `POST /api/tenants/scan`

**Headers:**
```
Authorization: Bearer <supabase-jwt>
Content-Type: application/json
```

**Request body:**
```json
{
  "company_url": "https://example.com"
}
```

**Response (200 OK):**
```json
{
  "scan_results": {
    "company_description": "Example Corp builds enterprise collaboration tools...",
    "value_proposition": "Making team communication effortless",
    "target_audience": "Mid-size B2B SaaS companies",
    "brand_voice": "Professional and authoritative",
    "key_products": ["Team Chat", "Video Conferencing", "Document Sharing"],
    "industry": "Enterprise SaaS",
    "metadata": {
      "title": "Example Corp — Team Collaboration",
      "description": "The best way to collaborate...",
      "og_image": "https://example.com/og.png"
    },
    "scanned_url": "https://example.com",
    "scanned_at": "2026-03-10T12:00:00Z",
    "fetch_error": null
  }
}
```

**Error responses:**
- `400` — Missing/invalid `company_url`
- `401` — Invalid/missing auth token
- `500` — Internal error

**Partial success:** If the URL fetches successfully but LLM fails, the response will include an `error` field inside `scan_results` plus whatever metadata was extracted.

---

## Verification Checklist

### 1. TypeScript Compiles
```bash
npx tsc --noEmit api/tenants/scan.ts
```

### 2. Endpoint Responds (after deploy)
```bash
# Should return 401 (no auth)
curl -s https://pixelport-launchpad.vercel.app/api/tenants/scan
```

### 3. SOUL.md Template Updated
Verify `buildSoulTemplate` in `provision-tenant.ts`:
- Reads `onboarding_data.scan_results`
- Includes `## Knowledge Base` section with brand context
- Maps agent_tone to personality description

### 4. No Hardcoded Secrets
```bash
grep -r "sk-\|eyJ\|supabase\.\w*\.co" api/tenants/scan.ts
# Expected: only process.env references
```

---

## Success Criteria

- [ ] `api/tenants/scan.ts` created with POST handler
- [ ] TypeScript compiles without errors
- [ ] Auth uses `supabase.auth.getUser()` (user must be logged in)
- [ ] URL validation (http/https only)
- [ ] Fetch with 10s timeout and size limit
- [ ] HTML metadata extraction (title, description, OG tags)
- [ ] Body text extraction (stripped HTML, truncated)
- [ ] LLM call to LiteLLM for brand profile generation
- [ ] Graceful error handling (partial results on failure)
- [ ] SOUL.md template enriched with scan results + tone mapping
- [ ] No hardcoded secrets

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`**
2. **Commit and push** — Vercel auto-deploys
3. **After deploy, sync Inngest:** `curl -X PUT https://pixelport-launchpad.vercel.app/api/inngest`
4. **Feedback for CTO:** Did the LiteLLM call work? Any issues with URL fetching? Observations about the scan quality?

---

## Important Reminders

- **Do NOT touch Lovable frontend files** in `src/`
- **Do NOT import Inngest from a local file** — use inline `new Inngest({...})` if needed
- **`api/lib/auth.ts`** is safe to import from (verified: only imports from npm packages)
- **LiteLLM model:** Use `openai/gpt-4o-mini` for the scan (fast and cheap)
- **No new npm dependencies needed** — built-in `fetch` handles HTTP, regex handles HTML parsing
