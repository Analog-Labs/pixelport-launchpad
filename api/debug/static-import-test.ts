import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';

// TEST H: Both supabase + inngest with inline client (no local file import)
const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  return res.status(200).json({
    test: 'H - both supabase + inline inngest (no local file)',
    timestamp: new Date().toISOString(),
    supabase_client: !!supabase,
    inngest_type: typeof inngest,
  });
}
