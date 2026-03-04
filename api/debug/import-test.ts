import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/debug/import-test
 *
 * Tests importing @supabase/supabase-js and inngest to diagnose FUNCTION_INVOCATION_FAILED.
 * Uses dynamic imports to catch errors at import time.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    node_version: process.version,
  };

  // Test 1: Dynamic import of @supabase/supabase-js
  try {
    const supabase = await import('@supabase/supabase-js');
    results.supabase = {
      ok: true,
      exports: Object.keys(supabase).slice(0, 10),
    };
  } catch (err) {
    results.supabase = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
    };
  }

  // Test 2: Dynamic import of inngest
  try {
    const inngest = await import('inngest');
    results.inngest = {
      ok: true,
      exports: Object.keys(inngest).slice(0, 10),
    };
  } catch (err) {
    results.inngest = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
    };
  }

  // Test 3: Try creating a Supabase client
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_PROJECT_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const client = createClient(url, key);
      // Just check it was created — don't make any requests
      results.supabase_client = { ok: true, type: typeof client };
    } else {
      results.supabase_client = { ok: false, error: 'Missing env vars' };
    }
  } catch (err) {
    results.supabase_client = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 4: Try creating an Inngest client
  try {
    const { Inngest } = await import('inngest');
    const client = new Inngest({
      id: 'pixelport-test',
      eventKey: process.env.INNGEST_EVENT_KEY,
    });
    results.inngest_client = { ok: true, type: typeof client };
  } catch (err) {
    results.inngest_client = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return res.status(200).json(results);
}
