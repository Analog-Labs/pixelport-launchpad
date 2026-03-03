import { serve } from 'inngest/express';
import { inngest } from './client';
import { provisionTenant } from './functions/provision-tenant';

export default serve({
  client: inngest,
  functions: [provisionTenant],
});
