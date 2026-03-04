import type { VercelRequest, VercelResponse } from '@vercel/node';

// TEST A: Just supabase (no inngest)
import { createClient } from '@supabase/supabase-js';

// TEST B: Just inngest (uncomment to test)
// import { inngest } from '../inngest/client';

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  return res.status(200).json({
    test: 'A - supabase only',
    timestamp: new Date().toISOString(),
    supabase_client: !!client,
  });
}
