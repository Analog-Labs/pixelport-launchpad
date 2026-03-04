import { serve } from 'inngest/express';
import { Inngest } from 'inngest';
import { provisionTenant } from './functions/provision-tenant';

// Inline client creation — importing from a local file that re-exports inngest
// crashes Vercel's esbuild bundler at runtime. Direct imports work fine.
const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export default serve({
  client: inngest,
  functions: [provisionTenant],
});
