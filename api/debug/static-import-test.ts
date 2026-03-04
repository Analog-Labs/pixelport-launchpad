import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '../inngest/client';

/**
 * GET /api/debug/static-import-test
 *
 * Uses the exact same static import pattern as the real API routes.
 * If this crashes, the issue is in module-level code.
 * If this works, the issue is in the handler logic.
 */

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// NOTE: Intentionally NOT throwing here — just checking
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  return res.status(200).json({
    timestamp: new Date().toISOString(),
    supabase_url_set: !!supabaseUrl,
    supabase_key_set: !!supabaseServiceKey,
    supabase_client_created: !!supabase,
    inngest_client_type: typeof inngest,
    inngest_id: (inngest as unknown as { id?: string }).id || 'unknown',
  });
}
