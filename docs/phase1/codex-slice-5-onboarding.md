# Codex Slice 5 — Tenant Creation + Onboarding Trigger

**Priority:** 🟢 Zero blockers — ready to execute immediately
**Assigned to:** Codex
**Depends on:** Slices 1-4 (all complete and merged to `main`)
**Estimated time:** 2-3 hours

---

## Project Context

**What is PixelPort?** An AI Chief of Staff SaaS for startup marketing teams. Each customer gets a visible AI agent (customizable name/avatar/tone) with invisible sub-agents behind the scenes.

**Where does this slice fit?** When a new user signs up via Supabase Auth and completes onboarding, we need to:
1. Create a tenant record in Supabase
2. Fire an Inngest event that triggers the 12-step provisioning workflow (already built in Slice 4)
3. Return the tenant to the frontend so the dashboard can start polling status

**Current state:** The API bridge (Slice 3) already has routes for reading tenant data (`/api/tenants/me`, `/api/tenants/status`, `/api/tenants/onboarding`), but there's no endpoint to **create** a tenant. Currently, there's no way for the frontend onboarding widget to trigger tenant creation + provisioning.

**How this connects to other slices:**
- Slice 3 provided tenant read/update routes — this slice adds the **create** route
- Slice 4 provided the Inngest provisioning workflow — this slice **triggers** it
- Slice 6 (Chat) and Slice 7 (Slack) depend on having a provisioned tenant

**Full project docs:**
- Product spec: `docs/pixelport-master-plan-v2.md` (Section 15, Phase 1 items 1.1-1.4)
- Active plan: `docs/ACTIVE-PLAN.md` (items 1.C1, 1.I1)
- Go Package: `docs/phase0/cto-phase0-go-package.md`

---

## Repository Access

- **Repo:** https://github.com/Analog-Labs/pixelport-launchpad
- **Branch:** Work on `main` (or create a branch `codex/phase1-slice-5` if preferred)
- Read `CLAUDE.md` first, then `docs/SESSION-LOG.md` and `docs/ACTIVE-PLAN.md`
- After completing work: update SESSION-LOG.md and ACTIVE-PLAN.md, commit and push

---

## What You're Building

### 1. Tenant Creation Endpoint

**File: `api/tenants/index.ts`** (NEW)

This is the most important deliverable. When the frontend onboarding widget completes, it calls `POST /api/tenants` to:
1. Verify the user is authenticated via Supabase Auth
2. Check that no tenant already exists for this user (prevent duplicates)
3. Create a tenant row with initial onboarding data
4. Fire the `pixelport/tenant.created` Inngest event to start provisioning
5. Return the new tenant record

```typescript
/**
 * POST /api/tenants — Create a new tenant + trigger provisioning
 * GET /api/tenants — Not supported (use /api/tenants/me instead)
 *
 * Called by the frontend onboarding widget after the user completes
 * the 3-step flow (company URL → goals → connect Slack).
 *
 * Flow:
 * 1. Authenticate user via Supabase Auth JWT
 * 2. Ensure no existing tenant for this user
 * 3. Generate slug from company name
 * 4. Insert tenant row (status: 'provisioning')
 * 5. Fire Inngest event → triggers 12-step provisioning workflow
 * 6. Return new tenant record
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '../inngest/client';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate a URL-safe slug from a company name.
 * "My Startup Inc." → "my-startup-inc"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Authenticate — get Supabase user ID
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = Array.isArray(authHeader) ? authHeader[0].slice(7) : authHeader.slice(7);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 2. Check for existing tenant (prevent duplicates)
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id, status')
      .eq('supabase_user_id', user.id)
      .maybeSingle();

    if (existingTenant) {
      // If tenant already exists, return it (idempotent)
      const { data: fullTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', existingTenant.id)
        .single();

      const { gateway_token, ...safeTenant } = fullTenant!;
      return res.status(200).json({ tenant: safeTenant, created: false });
    }

    // 3. Validate request body
    const {
      company_name,
      company_url,
      goals,
      agent_name,
      agent_tone,
      agent_avatar_url,
    } = req.body || {};

    if (!company_name || typeof company_name !== 'string') {
      return res.status(400).json({ error: 'company_name is required' });
    }

    // 4. Create tenant row
    const slug = generateSlug(company_name);
    const onboardingData = {
      company_name,
      company_url: company_url || null,
      goals: goals || [],
      agent_name: agent_name || 'Luna',
      agent_tone: agent_tone || 'professional',
      agent_avatar_url: agent_avatar_url || null,
      completed_at: new Date().toISOString(),
    };

    const { data: newTenant, error: insertError } = await supabase
      .from('tenants')
      .insert({
        supabase_user_id: user.id,
        name: company_name,
        slug,
        plan: 'trial',
        status: 'provisioning',
        onboarding_data: onboardingData,
        settings: {
          trial_budget_usd: 20,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('Tenant creation error:', insertError);
      // Check for unique constraint violation (slug collision)
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'A tenant with this name already exists. Please try a different company name.' });
      }
      return res.status(500).json({ error: 'Failed to create tenant' });
    }

    // 5. Fire Inngest provisioning event
    await inngest.send({
      name: 'pixelport/tenant.created',
      data: {
        tenantId: newTenant.id,
        trialMode: true,
      },
    });

    // 6. Return new tenant (strip sensitive fields)
    const { gateway_token, ...safeTenant } = newTenant;
    return res.status(201).json({ tenant: safeTenant, created: true });

  } catch (error) {
    console.error('Unexpected error in tenant creation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 2. Extend Inngest Serve Endpoint

**File: `api/inngest/index.ts`** — verify the existing serve endpoint properly exports the `provisionTenant` function. This was built in Slice 4. Confirm it matches:

```typescript
import { serve } from 'inngest/express';
import { inngest } from './client';
import { provisionTenant } from './functions/provision-tenant';

export default serve({
  client: inngest,
  functions: [provisionTenant],
});
```

If this file exists and looks correct, no changes needed.

### 3. Database Migration (if needed)

Check if the `tenants` table has a unique constraint on `supabase_user_id`. If not, add one:

**File: `supabase/migrations/003_tenant_user_unique.sql`** (NEW, only if needed)

```sql
-- Ensure one tenant per Supabase user
-- Check first: does idx_tenants_supabase_user already exist?
-- If it's a regular index (not unique), drop and recreate as unique.

ALTER TABLE tenants
  ADD CONSTRAINT tenants_supabase_user_id_unique UNIQUE (supabase_user_id);
```

**How to check:** Run against the Supabase DB:
```sql
SELECT indexdef FROM pg_indexes WHERE tablename = 'tenants' AND indexname = 'idx_tenants_supabase_user';
```
If the result contains `UNIQUE`, no migration needed. If it's a regular index, add the unique constraint.

---

## Environment Variables Needed

All env vars should already be set from Phase 0. Verify:

```bash
# Already set (Slice 1-4):
SUPABASE_PROJECT_URL=https://ecgzlfqhdzzfikvbrwna.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
LITELLM_URL=https://litellm-production-77cc.up.railway.app
LITELLM_MASTER_KEY=...
DO_API_TOKEN=...
```

No new env vars required for this slice.

---

## API Contract

### `POST /api/tenants`

**Headers:**
```
Authorization: Bearer <supabase-jwt>
Content-Type: application/json
```

**Request body:**
```json
{
  "company_name": "Acme Corp",
  "company_url": "https://acme.com",
  "goals": ["increase social media presence", "generate blog content"],
  "agent_name": "Luna",
  "agent_tone": "professional",
  "agent_avatar_url": null
}
```

**Response (201 Created):**
```json
{
  "tenant": {
    "id": "uuid",
    "supabase_user_id": "uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "trial",
    "status": "provisioning",
    "onboarding_data": { ... },
    "settings": { "trial_budget_usd": 20, "timezone": "UTC" },
    "created_at": "2026-03-10T00:00:00Z"
  },
  "created": true
}
```

**Response (200 OK — tenant already exists):**
```json
{
  "tenant": { ... },
  "created": false
}
```

**Error responses:**
- `400` — Missing `company_name`
- `401` — Invalid/missing auth token
- `409` — Slug collision
- `500` — Internal error

---

## Verification Checklist

After committing, verify:

### 1. TypeScript Compiles
```bash
npx tsc --noEmit api/tenants/index.ts
# Expected: no errors
```

### 2. Endpoint Exists
```bash
ls api/tenants/index.ts
# Expected: file exists
```

### 3. Auth Pattern Consistent
Verify the new endpoint:
- Extracts Bearer token from Authorization header
- Calls `supabase.auth.getUser(token)` for verification
- Checks for existing tenant before creating
- Uses `supabase_user_id` for tenant lookup (not Clerk)

### 4. Inngest Event Fires
Verify the endpoint calls:
```typescript
inngest.send({ name: 'pixelport/tenant.created', data: { tenantId, trialMode: true } })
```
This should match the event name expected by `provision-tenant.ts`:
```typescript
{ event: 'pixelport/tenant.created' }
```

### 5. Idempotency
The endpoint should be idempotent:
- If called twice with the same user, the second call returns the existing tenant with `created: false`
- No duplicate tenant rows or duplicate Inngest events

### 6. No Secrets in Code
```bash
grep -r "sk-\|eyJ\|supabase\.\w*\.co" api/tenants/index.ts
# Expected: only process.env references
```

---

## Success Criteria

- [ ] `api/tenants/index.ts` created with POST handler
- [ ] TypeScript compiles without errors
- [ ] Auth uses `supabase.auth.getUser()` (not Clerk)
- [ ] Duplicate check prevents multiple tenants per user
- [ ] Inngest event `pixelport/tenant.created` fires with `tenantId`
- [ ] Response strips `gateway_token` from returned tenant
- [ ] Slug generated from company name
- [ ] No hardcoded secrets
- [ ] Migration 003 created if unique constraint is missing

---

## After Completing This Slice

1. **Update `docs/SESSION-LOG.md`** — add a new "Last Session" entry
2. **Update `docs/ACTIVE-PLAN.md`** — check off `1.C1`
3. **Feedback for CTO** — include in SESSION-LOG:
   - Did the Inngest event fire correctly?
   - Any issues with the supabase_user_id unique constraint?
   - Observations about the tenant creation flow
4. **Commit and push** all changes

---

## Important Reminders

- **Do NOT touch Lovable frontend files** in `src/` — those are managed by the founder
- **The Inngest provisioning workflow** (Slice 4) is already built — this slice just triggers it
- **Supabase Auth** is the auth system — no Clerk
- **The `inngest` client** is already set up in `api/inngest/client.ts`
- **Test tenant creation** by inserting a row and verifying the Inngest event appears in Inngest Cloud dashboard
- **Slug collisions** are handled with a 409 response — the frontend can prompt for a different name
