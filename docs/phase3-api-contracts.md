# Phase 3: Social Publishing + Video — API Contracts

> **Purpose:** Define API specs so founder can start building frontend pages in Lovable while CTO builds backend.
> **Phase 3 goal:** Research → Write → Image/Video → Approve → Schedule → Publish → Track
> **Timeline:** Sessions 10-16 (estimated 3-4 sessions CTO, parallel frontend work)

---

## New API Endpoints (Phase 3)

### 3.1: Social Connections (X + LinkedIn OAuth)

#### `GET /api/connections/social`
Returns connected social accounts for the tenant.

**Auth:** Bearer token (dashboard)

**Response:**
```json
{
  "connections": [
    {
      "platform": "x",
      "connected": true,
      "account_name": "@vidacious",
      "account_id": "1234567890",
      "connected_at": "2026-03-10T12:00:00Z",
      "scopes": ["read", "write"],
      "expires_at": "2026-06-10T12:00:00Z"
    },
    {
      "platform": "linkedin",
      "connected": false
    }
  ]
}
```

#### `GET /api/connections/x/install`
Initiates X OAuth 2.0 flow. Redirects to X authorization page.

**Auth:** Bearer token (dashboard)
**Returns:** 302 redirect to X OAuth URL

#### `GET /api/connections/x/callback`
X OAuth callback. Stores tokens, redirects to dashboard.

**Query params:** `code`, `state`
**Returns:** 302 redirect to `/dashboard/connections?x=connected`

#### `GET /api/connections/linkedin/install`
Initiates LinkedIn OAuth 2.0 flow. Redirects to LinkedIn authorization page.

**Auth:** Bearer token (dashboard)
**Returns:** 302 redirect to LinkedIn OAuth URL

#### `GET /api/connections/linkedin/callback`
LinkedIn OAuth callback. Stores tokens, redirects to dashboard.

**Query params:** `code`, `state`
**Returns:** 302 redirect to `/dashboard/connections?linkedin=connected`

---

### 3.2: Social Publishing

#### `POST /api/agent/publish`
Agent prepares content for social publishing (creates a publishable draft).

**Auth:** X-Agent-Key header (agent)

**Request body:**
```json
{
  "task_id": "uuid",
  "platform": "linkedin",
  "content": {
    "text": "The full post text...",
    "media_urls": ["https://...image.png"],
    "hashtags": ["#startup", "#marketing"],
    "thread": null
  },
  "scheduled_for": "2026-03-15T14:00:00Z",
  "metadata": {
    "content_type": "thought_leadership",
    "target_audience": "startup founders",
    "estimated_reach": "medium"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "platform": "linkedin",
  "status": "scheduled",
  "scheduled_for": "2026-03-15T14:00:00Z",
  "content": { ... }
}
```

#### `GET /api/social/posts`
List published and scheduled posts for the tenant.

**Auth:** Bearer token (dashboard)

**Query params:**
- `platform` — filter by platform (x, linkedin, all)
- `status` — filter by status (scheduled, published, draft)
- `limit` — default 20
- `offset` — for pagination

**Response:**
```json
{
  "posts": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "platform": "linkedin",
      "status": "published",
      "content": {
        "text": "...",
        "media_urls": [],
        "hashtags": []
      },
      "scheduled_for": "2026-03-15T14:00:00Z",
      "published_at": "2026-03-15T14:00:12Z",
      "metrics": {
        "impressions": 1250,
        "engagements": 45,
        "clicks": 12,
        "shares": 3
      },
      "created_at": "2026-03-14T10:00:00Z"
    }
  ],
  "total": 42,
  "has_more": true
}
```

#### `POST /api/social/posts/:id/publish-now`
Manually trigger publishing for a scheduled post.

**Auth:** Bearer token (dashboard)

**Response:**
```json
{
  "id": "uuid",
  "status": "published",
  "published_at": "2026-03-15T09:30:00Z",
  "platform_post_id": "li_12345"
}
```

#### `DELETE /api/social/posts/:id`
Cancel a scheduled post (only if not yet published).

**Auth:** Bearer token (dashboard)

**Response:**
```json
{ "deleted": true, "id": "uuid" }
```

#### `PUT /api/social/posts/:id/reschedule`
Reschedule a post to a different time.

**Auth:** Bearer token (dashboard)

**Request body:**
```json
{
  "scheduled_for": "2026-03-16T10:00:00Z"
}
```

---

### 3.3: Video Generation

#### `POST /api/agent/generate-video`
Agent requests video generation (extends image gen pattern).

**Auth:** X-Agent-Key header (agent)

**Request body:**
```json
{
  "prompt": "Create a 15-second product demo showing...",
  "provider": "runway",
  "model": "gen-4",
  "duration": 15,
  "aspect_ratio": "16:9",
  "style": "professional",
  "task_description": "Product demo video for LinkedIn post"
}
```

**Supported providers:** `runway`, `sora`, `veo`, `heygen`

**Response:**
```json
{
  "video_url": "https://...",
  "provider": "runway",
  "model": "gen-4",
  "duration": 15,
  "status": "completed",
  "task_id": "uuid"
}
```

---

### 3.4: Scheduling Engine

The scheduling engine uses Inngest durable workflows (no new REST endpoints needed — it's triggered internally when posts are approved with a `scheduled_for` time).

**Inngest functions (internal, not REST):**
- `pixelport/post.scheduled` — fires when a post is created with future `scheduled_for`
- `pixelport/post.publish` — fires at scheduled time, calls platform API to publish
- `pixelport/post.publish-retry` — retries on failure (max 3 attempts)

**Dashboard interactions:** Use existing `GET/PUT/DELETE /api/social/posts/*` endpoints above.

---

### 3.5: Performance Tracking

#### `GET /api/social/metrics`
Get aggregated social metrics for the tenant.

**Auth:** Bearer token (dashboard)

**Query params:**
- `platform` — filter by platform (x, linkedin, all)
- `period` — `7d`, `30d`, `90d` (default: 30d)
- `group_by` — `day`, `week`, `month` (default: day)

**Response:**
```json
{
  "summary": {
    "total_posts": 24,
    "total_impressions": 45000,
    "total_engagements": 1200,
    "total_clicks": 350,
    "avg_engagement_rate": 2.7,
    "top_platform": "linkedin"
  },
  "by_platform": {
    "linkedin": {
      "posts": 15,
      "impressions": 32000,
      "engagements": 950,
      "clicks": 280
    },
    "x": {
      "posts": 9,
      "impressions": 13000,
      "engagements": 250,
      "clicks": 70
    }
  },
  "timeline": [
    {
      "date": "2026-03-01",
      "impressions": 1500,
      "engagements": 45,
      "posts_published": 2
    }
  ],
  "top_posts": [
    {
      "id": "uuid",
      "platform": "linkedin",
      "text_preview": "The future of AI in marketing...",
      "impressions": 5200,
      "engagements": 180,
      "published_at": "2026-03-08T14:00:00Z"
    }
  ]
}
```

#### `POST /api/agent/metrics-snapshot`
Agent submits a daily metrics snapshot from social APIs.

**Auth:** X-Agent-Key header (agent)

**Request body:**
```json
{
  "platform": "linkedin",
  "date": "2026-03-10",
  "metrics": {
    "followers": 1250,
    "impressions": 4500,
    "engagements": 120,
    "profile_views": 85
  },
  "post_metrics": [
    {
      "platform_post_id": "li_12345",
      "task_id": "uuid",
      "impressions": 1200,
      "engagements": 45,
      "clicks": 12,
      "shares": 3
    }
  ]
}
```

---

### 3.6: Weekly Performance Report

#### `GET /api/reports/weekly`
Get the latest weekly performance report.

**Auth:** Bearer token (dashboard)

**Query params:**
- `week` — ISO week (e.g., `2026-W10`), defaults to current

**Response:**
```json
{
  "week": "2026-W10",
  "generated_at": "2026-03-09T09:00:00Z",
  "summary": "Published 8 posts this week. LinkedIn engagement up 15%. Top post reached 5,200 impressions.",
  "highlights": [
    "LinkedIn engagement rate increased 15% week-over-week",
    "Best performing content: thought leadership posts",
    "Optimal posting time identified: Tuesday 2pm UTC"
  ],
  "metrics": {
    "posts_published": 8,
    "total_impressions": 18500,
    "total_engagements": 520,
    "engagement_rate": 2.8,
    "week_over_week_change": {
      "impressions": 0.12,
      "engagements": 0.15,
      "posts": 0.0
    }
  },
  "recommendations": [
    "Increase thought leadership posts — 3x engagement vs product updates",
    "Test posting on Wednesday morning — untapped time slot",
    "Add video to next LinkedIn post — video posts get 2x engagement"
  ]
}
```

The report is generated by an Inngest scheduled function that runs weekly. The agent pulls metrics from social APIs, analyzes trends, and writes the report to Supabase. It's also delivered via Slack.

---

## Database Changes (Phase 3 Migration)

```sql
-- New table: social_connections (OAuth tokens for X + LinkedIn)
CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,              -- 'x' | 'linkedin'
  account_id TEXT,                     -- Platform user/org ID
  account_name TEXT,                   -- Display name
  access_token TEXT NOT NULL,          -- Encrypted OAuth access token
  refresh_token TEXT,                  -- Encrypted OAuth refresh token
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, platform)
);

-- New table: social_posts (published + scheduled posts)
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id),   -- Links to content pipeline task
  platform TEXT NOT NULL,                     -- 'x' | 'linkedin'
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | scheduled | publishing | published | failed
  content JSONB NOT NULL DEFAULT '{}',        -- {text, media_urls, hashtags, thread}
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,                      -- ID from X/LinkedIn after publishing
  metadata JSONB DEFAULT '{}',                -- Content type, target audience, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- New table: social_metrics (daily snapshots from social APIs)
CREATE TABLE IF NOT EXISTS social_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  account_metrics JSONB DEFAULT '{}',         -- {followers, impressions, profile_views}
  post_metrics JSONB DEFAULT '[]',            -- [{post_id, impressions, engagements, clicks}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, platform, date)
);

-- New table: weekly_reports (generated performance reports)
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  week TEXT NOT NULL,                          -- ISO week e.g. '2026-W10'
  report JSONB NOT NULL DEFAULT '{}',         -- Full report data
  delivered_via TEXT[] DEFAULT '{}',           -- ['slack', 'dashboard']
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, week)
);
```

---

## Frontend Pages Needed (Founder Scope)

### 3.F1: Social Publishing Page
- **Route:** `/dashboard/social`
- **Data:** `GET /api/social/posts`
- **Features:** Post list with status filters, platform badges, scheduled time, metrics preview
- **Actions:** Publish now, reschedule (drag or modal), cancel scheduled

### 3.F2: Performance Page
- **Route:** `/dashboard/performance`
- **Data:** `GET /api/social/metrics` + `GET /api/reports/weekly`
- **Features:** KPI cards (impressions, engagements, rate), line charts by day/week, top posts list, weekly report summary
- **Charts:** Use Recharts (already in package.json)

### 3.F3: Scheduling Calendar Enhancement
- **Route:** `/dashboard/calendar` (existing)
- **Data:** `GET /api/social/posts?status=scheduled`
- **Enhancement:** Show platform icons on calendar dots, drag-to-reschedule calls `PUT /api/social/posts/:id/reschedule`

### 3.F4: Connections Page Enhancement
- **Route:** `/dashboard/connections` (existing)
- **Data:** `GET /api/connections/social`
- **Enhancement:** Add X and LinkedIn connect buttons alongside Slack

---

## Environment Variables Needed

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `X_CLIENT_ID` | X OAuth app client ID | developer.x.com |
| `X_CLIENT_SECRET` | X OAuth app client secret | developer.x.com |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth app client ID | developer.linkedin.com |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth app client secret | developer.linkedin.com |
| `RUNWAY_API_KEY` | Runway Gen-4 video generation | runway.ml |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | AES key for OAuth token encryption | Generate: `openssl rand -hex 32` |

---

## Implementation Order

**Session A (CTO — X + LinkedIn OAuth):**
1. Database migration (007_phase3_social.sql)
2. OAuth routes for X (install + callback + token storage)
3. OAuth routes for LinkedIn (install + callback + token storage)
4. `GET /api/connections/social` endpoint

**Session B (CTO — Publishing + Video):**
1. `POST /api/agent/publish` endpoint
2. `GET/PUT/DELETE /api/social/posts/*` endpoints
3. Video gen endpoint (`POST /api/agent/generate-video`)
4. Inngest scheduling function

**Session C (CTO — Metrics + Reports):**
1. `POST /api/agent/metrics-snapshot` endpoint
2. `GET /api/social/metrics` endpoint
3. Weekly report Inngest cron function
4. `GET /api/reports/weekly` endpoint

**Founder (parallel with CTO):**
- Session A → build 3.F4 (Connections page enhancements)
- Session B → build 3.F1 (Social Publishing page)
- Session C → build 3.F2 (Performance page) + 3.F3 (Calendar enhancements)
