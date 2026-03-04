import type { VercelRequest, VercelResponse } from '@vercel/node';

// TEST G: After vercel.json externals fix — import from local inngest client
import { createClient } from '@supabase/supabase-js';
import { inngest } from '../inngest/client';

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  return res.status(200).json({
    test: 'G - both supabase + inngest with externals fix',
    timestamp: new Date().toISOString(),
    supabase_client: !!supabase,
    inngest_type: typeof inngest,
  });
}
