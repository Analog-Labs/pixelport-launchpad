# Session 7 — Live Canary (board11)

- **Date:** 2026-03-27
- **Branch tested:** `main` (post-merge PR `#62`, merge commit `accff8f`)
- **Production target:** `https://pixelport-launchpad.vercel.app`
- **Account:** `board11@ziffyhomes.com`
- **Website seed used:** `https://stripe.com`

## Goal

Validate Session 7 on production for one fresh tenant using real website onboarding data:

1. tenant launch reaches truthful `active` lifecycle
2. Knowledge dashboard surface is present and usable
3. section edit/save flow is conflict-safe
4. sync truth transitions to a terminal state and matches runtime file outputs

## Flow Coverage

Validated with authenticated browser + API checks + host-level runtime verification:

1. Login with `board11@ziffyhomes.com`
2. Complete onboarding (`Company -> Strategy -> Task -> Launch`)
3. Wait for tenant to reach `active`
4. Open `/dashboard/knowledge`
5. Verify section UX (expand/collapse, markdown read mode, edit/save/cancel)
6. Verify conflict behavior using stale-tab save
7. Verify sync behavior and run manual retry path
8. Verify runtime file output on tenant droplet over SSH

## Tenant Evidence

- tenant id: `6da5aec1-c63c-4dc9-bbc1-91603f42a452`
- tenant slug: `board11-stripe-canary`
- tenant status: `active`
- bootstrap status: `completed`
- droplet id: `561153803`
- droplet ip: `147.182.211.186`

## Session 7 Critical Path Checks

### 1) Knowledge dashboard route + sidebar entry

- Sidebar includes `Knowledge`.
- `/dashboard/knowledge` route loads and renders the page-level sync rail.

### 2) Five-section Knowledge surface

- Five collapsible section cards render:
  - Company Overview
  - Products and Offers
  - Audience and ICP
  - Brand Voice
  - Competitors
- Cards expand/collapse from keyboard/click controls.
- Markdown displays in read mode.

### 3) Edit/save + conflict guard behavior

- Section save persists content and increments mirror revision.
- Live stale-write conflict check succeeded:
  - tab A save with expected revision accepted (`200`)
  - stale tab B save rejected with `409` and `code=knowledge_conflict`

### 4) Sync truth behavior (`pending -> synced`) with manual retry

- Initial canary edit sequence left sync in `pending` for revision `3`.
- Diagnostic action:
  - `PUT /api/inngest` returned `{"message":"Successfully registered","modified":true}`
  - manual retry triggered via `POST /api/tenants/onboarding` with:
    - `force_knowledge_sync=true`
    - `knowledge_mirror_expected_revision=3`
- Result after retry:
  - `/api/tenants/status` moved to terminal `knowledge_sync.status=synced`
  - `revision=3`, `synced_revision=3`, `seeded_revision=1`
  - `last_error=null`
  - terminal sync timestamp: `2026-03-27T06:25:56.142Z`

### 5) Runtime artifact verification

SSH check on `147.182.211.186` confirmed:
- `/opt/openclaw/workspace-main/knowledge` contains all five expected files
- `/opt/openclaw/workspace-main/knowledge/company-overview.md` includes saved canary content:
  - `First save from tab A at 2026-03-27T06:14Z`

## Production Smoke Endpoints

All passed (`200`) during canary:

- `/`
- `/api/tenants/me`
- `/api/tenants/status`
- `/api/tenant-proxy/companies/sidebar-badges`
- `/api/tenant-proxy/companies/dashboard`
- `/api/tenant-proxy/companies/activity?limit=8`
- `/api/tenant-proxy/companies/issues`

## Verdict

**PASS** — Session 7 is production-safe on `main` with one full successful fresh-tenant canary (`board11`).

No code hotfix loop was required. `board12` and `board13` were not needed.
