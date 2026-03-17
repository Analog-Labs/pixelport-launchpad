# PixelPort — Master Product Spec & Build Plan

**Version:** 2.0
**Date:** February 28, 2026
**Author:** Sanchal Ranjan (Founder) + Claude (CTO / Senior PM)
**Status:** Active with Pivot Overrides — Source of Truth

---

## Decision Overrides (Post-Lock)

| Date | Decision | Old | New | Rationale |
|------|----------|-----|-----|-----------|
| 2026-03-03 | Auth provider | Clerk (OAuth + Magic Link) | Supabase Auth (Google OAuth + email/password) | Native Lovable integration, zero new vendors, already wired to existing Supabase instance. Migration path to Clerk available Phase 4 if needed for team management. |
| 2026-03-16 | Runtime architecture | Launchpad-centric runtime assumptions | PixelPort-owned Paperclip fork is the primary product/runtime source of truth. `pixelport-launchpad` remains marketing + billing + thin provisioning bridge. | Founder-approved pivot to reduce complexity and align with Paperclip-native behavior. |
| 2026-03-16 | Auth source of truth | Supabase Auth primary | Paperclip auth primary for product runtime | Aligns with the Paperclip-primary runtime model and removes dual-auth bridge complexity in the pivot release. |
| 2026-03-16 | Active dogfood scope | Growth Swarm as active maintenance workstream | Growth Swarm archived/deactivated (historical only) | Focus all active product execution on the pivot path. |
| 2026-03-16 | Onboarding and provisioning flow | Legacy 3-step launchpad onboarding assumptions | `Company -> Provision -> Task -> Launch` with provisioning gate before task unlock | Matches approved pivot UX and runtime gating model. |
| 2026-03-16 | Workspace contract policy | PixelPort-specific scaffold evolution | Preserve Paperclip default workspace behavior; additive onboarding context in `SOUL.md`; no enforced 3-agent topology in templates | Preserve upstream behavior and avoid functional drift while branding/customizing safely. |
| 2026-03-16 | Terminology policy | `CEO` naming in defaults | `Chief of Staff` in user-facing UI/copy/markdown where applied, without changing runtime behavior | Brand alignment with minimal risk. |
| 2026-03-16 | Provisioning trigger scope | Stripe-first framing in product flow | V1 testing uses onboarding-trigger provisioning with allowlist gating; Stripe trigger explicitly deferred | Enables immediate testing while keeping a clear phase-2 hook. |

> The decision override table above takes precedence over older conflicting sections in this spec.
> Binding pivot execution contract: `docs/pixelport-pivot-plan-2026-03-16.md`.

---

## What Changed (v1.0 → v2.0)

This revision incorporates 52 locked architectural decisions from founder Q&A sessions and external advisory review. Key shifts:

| Area | v1.0 | v2.0 |
|------|------|------|
| Product framing | "3-agent team" (Luna + Scout + Spark visible) | **"Your AI Chief of Staff"** — one agent visible, sub-agents work behind scenes |
| Frontend | Next.js + Tailwind (custom-built) | **Lovable** (AI-native frontend builder) for rapid shipping |
| LLM routing | Direct API calls, BYO keys only | **LiteLLM** gateway from day one; PixelPort provides default keys, BYO optional |
| Workflow engine | OpenClaw cron + Slack flows | **Inngest** for durable workflows (approvals, scheduling, onboarding) |
| Analytics | PostHog planned for Phase 5 | **PostHog** from Phase 1; Luna queries via MCP to self-optimize |
| Memory | Markdown vault files only | **Mem0** managed cloud from day one (vector + graph memory) |
| Email | Phase 5 | **Phase 1** — email is core to a chief of staff |
| Image gen | Phase 5 | **Phase 2** — images are essential for social content |
| Video gen | Phase 5 | **Phase 3** — GTM without video is incomplete |
| Onboarding | 6-step conversational flow | **3-step** (URL + goals + connect Slack — Luna auto-scans the rest) |
| Content packs | Rigid template (LinkedIn + X + variants) | **Platform-native** — Luna decides what each post needs (images, stats, video, hashtags) |
| Pricing | Not specified | **$299 / $999 / $3K+** per-agent tiers, transparent, 14-day free trial |
| Revisions | 3 cycles max | **Unlimited** revisions until human approves |
| Autonomy | Limited | Full chief of staff model — research + draft autonomously, approval only for publishing |
| Content initiation | Human-triggered | **Luna proactive** — scans trends, proposes content angles |

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Positioning & Differentiation](#2-positioning--differentiation)
3. [Architecture Overview](#3-architecture-overview)
4. [Agent System Design](#4-agent-system-design)
5. [Memory Architecture](#5-memory-architecture)
6. [User Journey & Onboarding](#6-user-journey--onboarding)
7. [Content Production Pipeline](#7-content-production-pipeline)
8. [Feature Specification](#8-feature-specification)
9. [Dashboard UI Specification](#9-dashboard-ui-specification)
10. [Integrations & Connections](#10-integrations--connections)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Data, Privacy & Security](#12-data-privacy--security)
13. [Pricing & GTM](#13-pricing--gtm)
14. [Team & Work Split](#14-team--work-split)
15. [Build Phases](#15-build-phases)
16. [Growth Swarm Migration](#16-growth-swarm-migration)
17. [Decisions Log](#17-decisions-log)
18. [Open Questions](#18-open-questions)

---

## 1. Product Vision

### One-Liner
PixelPort is your AI Chief of Staff for marketing — a persistent, proactive agent that researches competitors, creates platform-native content (text, images, videos), manages approvals, and reports performance, all from Slack and a purpose-built dashboard.

### The Problem
Startups drown in GTM busywork: inconsistent posting, zero competitive intel, content that's either generic AI slop or takes hours, and analytics scattered across 6 tools. Hiring a marketing team costs $200K+/year. Current AI tools are either too broad (not marketing-focused) or too shallow (just schedule posts).

### The Solution
PixelPort gives every team a persistent AI Chief of Staff:

- **Your Chief of Staff** (default name: Luna, customizable): Always-on interface via Slack and web dashboard. Collects company context, produces content, monitors competitors, reports results, learns from feedback. The single point of contact — humans talk to one agent, not a team.
- **Behind the scenes**: The Chief of Staff spins up specialized sub-agents as needed — research workers for competitor analysis, content workers for drafting, analytics workers for performance tracking. Customers see activity in the dashboard but only interact with their Chief of Staff.
- **Expandable**: As workload grows, the Chief of Staff suggests adding capacity ("We're producing a lot — want me to spin up a dedicated video specialist?").

### Core Principles

1. **Chief of Staff model**: One agent runs the show. Customers talk to their Chief of Staff, who manages everything. Not a chatbot — a proactive manager.
2. **Human-in-the-loop by default**: Everything that goes live (posts, emails) gets approval first. Auto-post only when explicitly enabled.
3. **Proactive, not reactive**: The agent scans for opportunities, suggests content, monitors competitors, and proposes workflows — without being asked.
4. **Learn and evolve**: The agent builds persistent memory via Mem0. What hooks work, what formats perform, what the founder's voice sounds like. Gets smarter every week.
5. **Quiet unless needed**: No thousand messages a day. Like a good chief of staff — competent, not annoying. Configurable reporting cadence.
6. **Platform-native content**: Every piece of content looks like it was made by a senior marketer for that specific platform. Images included by default, video when it adds value, stats when they exist.

---

## 2. Positioning & Differentiation

### Primary Positioning
**"Your AI Chief of Staff"** — employee framing, not tool framing.

### What Exists

**Tensol (YC W26)**: OpenClaw-based AI employees across engineering, sales, support, and marketing. Broad focus. Marketing is one slice — basic post drafting, scheduling, comment monitoring. No deep research, no image/video gen, no multi-agent collaboration, no KPI-driven content.

**Other competitors**: Lindy (agent automation, broad), Relevance AI (agent platform, credit-based), CrewAI (multi-agent framework), Copy.ai (GTM content, but no agents), Jasper (enterprise marketing AI, no chief of staff model).

### PixelPort Differentiators

| Capability | Competitors | PixelPort |
|-----------|-------------|-----------|
| Product model | Tool or broad agent platform | **AI employee** — Chief of Staff that runs your marketing |
| Agent visibility | Multiple agents to manage | **One agent interface**, sub-agents behind scenes |
| Content quality | Template-based, generic | **Platform-native** — Luna decides what each post needs |
| Competitor intel | None or manual | **Proactive** — monitors competitors, flags moves, suggests counter-content |
| Media generation | Text only or separate tool | **Images + video built in** (FLUX, Imagen, Runway, HeyGen, Sora) |
| Memory | Session-based or none | **Persistent Mem0** — vector + graph memory, learns over time |
| Approval flow | Generic | **Slack-first** with contextual approvals + dashboard sync |
| Onboarding | Generic setup wizard | **3-step** — URL + goals + Slack, agent auto-scans the rest |
| Autonomy | Reactive (user requests) | **Proactive** — researches, drafts, proposes without asking |
| Reporting | Manual or basic | **KPI negotiation loop** — agent proposes KPIs, tracks, re-evaluates monthly |
| Personalization | Fixed agent names | **Customer names agent**, uploads avatar, sets tone |

### Target Customer

**Primary**: Startup founders and small marketing teams (1-5 people) who:
- Have product-market fit but no marketing muscle
- Spend $500-5000/month on marketing tools and freelancers
- Are active on X, LinkedIn, and have a blog/newsletter
- Want leverage, not another tool to configure

**Secondary**: Solo marketers at Series A-B companies who need to scale output without hiring.

---

## 3. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PIXELPORT PLATFORM                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              WEB APPLICATION (Lovable + Vercel)               │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │   │
│  │  │  Auth        │  │  Dashboard   │  │  Onboarding       │   │   │
│  │  │  (Clerk)     │  │  (All pages  │  │  (3-step Luna     │   │   │
│  │  │             │  │   in Lovable) │  │   chat widget)    │   │   │
│  │  └─────────────┘  └──────────────┘  └───────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                     PixelPort API (Vercel/serverless)               │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  CONTROL PLANE (Serverless)                   │   │
│  │                                                               │   │
│  │  ┌──────────────────┐  ┌────────────────────────────────┐   │   │
│  │  │  Tenant Manager  │  │  Instance Provisioner           │   │   │
│  │  │  (Supabase DB)   │  │  (DO Droplet per customer)     │   │   │
│  │  └──────────────────┘  └────────────────────────────────┘   │   │
│  │                                                               │   │
│  │  ┌──────────────────┐  ┌────────────────────────────────┐   │   │
│  │  │  Inngest         │  │  LiteLLM Gateway               │   │   │
│  │  │  (Workflows:     │  │  (LLM routing, budget caps,    │   │   │
│  │  │   approvals,     │  │   multi-provider, metering)    │   │   │
│  │  │   scheduling,    │  │                                 │   │   │
│  │  │   onboarding)    │  └────────────────────────────────┘   │   │
│  │  └──────────────────┘                                        │   │
│  │                                                               │   │
│  │  ┌──────────────────┐  ┌────────────────────────────────┐   │   │
│  │  │  PostHog         │  │  Mem0 (Managed Cloud)           │   │   │
│  │  │  (Analytics,     │  │  (Persistent memory per tenant, │   │   │
│  │  │   LLM tracking,  │  │   vector + graph, multi-level) │   │   │
│  │  │   agent MCP)     │  │                                 │   │   │
│  │  └──────────────────┘  └────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              CUSTOMER INSTANCES (Isolated Droplets)           │   │
│  │                                                               │   │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │   │
│  │  │  Customer A       │  │  Customer B       │                 │   │
│  │  │  DO Droplet       │  │  DO Droplet       │                 │   │
│  │  │                   │  │                   │                 │   │
│  │  │  ┌─────────────┐ │  │  ┌─────────────┐ │                 │   │
│  │  │  │ OpenClaw     │ │  │  │ OpenClaw     │ │                 │   │
│  │  │  │ (pinned tag) │ │  │  │ (pinned tag) │ │                 │   │
│  │  │  │             │ │  │  │             │ │                 │   │
│  │  │  │ Chief of    │ │  │  │ Chief of    │ │                 │   │
│  │  │  │ Staff agent │ │  │  │ Staff agent │ │                 │   │
│  │  │  │ + sub-agents│ │  │  │ + sub-agents│ │                 │   │
│  │  │  └─────────────┘ │  │  └─────────────┘ │                 │   │
│  │  │                   │  │                   │                 │   │
│  │  │  AgentMail inbox  │  │  AgentMail inbox  │                 │   │
│  │  └──────────────────┘  └──────────────────┘                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | **Lovable** | AI-native builder, ship full dashboard pages fast, solo-friendly |
| API | Vercel serverless functions | Start serverless, split later if needed |
| Auth | **Clerk** (OAuth + Magic Link) | Quick setup, handles teams, Lovable-compatible |
| Database | **Supabase** (PostgreSQL) | Tenant metadata, billing, analytics |
| Agent Runtime | **OpenClaw** (Docker, pinned version tags) | Proven, same as Tensol, Growth Swarm validated |
| LLM Gateway | **LiteLLM** (central server) | Multi-provider routing, budget caps, metering, BYO key support |
| Memory | **Mem0** (managed cloud) | Persistent vector + graph memory per tenant, auto fact extraction |
| Workflow Engine | **Inngest** (free: 50K exec/mo) | Durable workflows for approvals, scheduling, onboarding |
| Analytics | **PostHog** (free: 1M events) | User analytics + LLM tracking + MCP server for agent queries |
| VM Hosting | **DigitalOcean** Droplets | One per customer, isolated, simple |
| Email | **AgentMail** (default) | API-first, built for AI agents, no OAuth hassle |
| Queue/Events | Redis or Upstash | Webhook routing, job queues |
| Payments | **Stripe** | Standard |
| Object Storage | DO Spaces or S3 | Agent outputs, images, videos |

### Key Architectural Decisions

1. **One DigitalOcean droplet per customer** — strongest isolation, simplest to manage (~$24-48/mo per customer). Data never crosses boundaries. (Q1)

2. **Hybrid control plane** — PixelPort web+API on Vercel/serverless (cheap, scales), customer OpenClaw instances on dedicated droplets. Control plane manages provisioning, config, dashboards. Data plane is where agents run. (Q2)

3. **LiteLLM from day one** — all LLM calls route through LiteLLM gateway. Enables multi-provider support, budget caps with explicit notifications, metering, and graceful model downgrades. (Q6)

4. **Inngest for durable workflows** — replaces cron-driven flows. `waitForEvent()` handles "wait for human approval" patterns. Manages onboarding sequences, content scheduling, approval flows. (Q13)

5. **Mem0 managed cloud** — persistent memory from day one. Vector DB for semantic retrieval + graph DB for entity relationships. Multi-level scoping (user, agent, session). Apply for startup program (3 months free Pro). (Q51)

6. **Slack Socket Mode per tenant VM for now** — won't hit 10 customers for months. Centralize ingestion later when needed. (Q3)

7. **Growth Swarm = Customer #1** — Vidacious deployment becomes first tenant on PixelPort. Same infrastructure, first instance provisioned. (Existing)

---

## 4. Agent System Design

### Product Model: "Your AI Chief of Staff"

Customers get one visible agent — their Chief of Staff. Default name is Luna, but customers can rename, upload an avatar, and set the tone (casual / professional / custom). (Q32, Q34, Q35)

The Chief of Staff spins up sub-agents behind the scenes as needed: research workers, content workers, analytics workers. Customers see sub-agent activity in the dashboard but only interact with their Chief of Staff in Slack and chat. (Q34)

### Chief of Staff — The Product (Agent ID: `main`)

**Role**: Interface between humans and AI team. Proactive manager, not a chatbot.

**Capabilities**:
- Lives in Slack and web dashboard — always available
- Collects company intel during onboarding and ongoing (auto-scans website + social profiles)
- Produces platform-native content: text, images, video, stats, hashtags — whatever each post needs
- Monitors competitors proactively — flags moves, suggests counter-content
- Reports daily digests and weekly summaries (configurable cadence)
- Proposes KPIs, tracks them, re-evaluates monthly
- Suggests and builds automated workflows ("Posts do best on Wednesdays — auto-draft 3?")
- Manages email via AgentMail (approval-gated outbound)
- Queries PostHog analytics via MCP to self-optimize content strategy
- Unlimited revision cycles until human approves

**Autonomy Model** (Q45):
- ✅ **Autonomous**: Research, competitive monitoring, drafting content, vault updates, trend scanning, internal delegation to sub-agents
- 🔒 **Requires approval**: Publishing content, sending outbound emails, spending budget, making crisis/PR decisions

**Personality**: Customizable (Q35). Default: friendly, concise, proactive. Light emoji allowed. Configurable reporting frequency.

**Tools**: file system, sessions (spawn/manage sub-agents), Mem0 memory, web search + fetch, browser, Slack messaging, AgentMail (exec+curl), cron/automation, image analysis, PostHog MCP.

**Model**: Best available via LiteLLM (default: provided by PixelPort, customer can add BYO keys).

### Sub-Agents (Behind the Scenes)

The Chief of Staff spawns these as needed. Customers see their activity in the dashboard but don't interact directly.

**Research Worker** (maps to Growth Swarm's SCOUT):
- Deep competitor analysis, trend validation, audience research, SEO intel
- Proactive monitoring — flags competitor moves, trending topics
- Confidence-tagged findings with sources
- Public sources only, compliance-safe

**Content Worker** (maps to Growth Swarm's SPARK):
- Turns briefs into platform-native content
- Blog posts, social posts, email sequences, ad copy
- Image generation via configured providers
- Video script generation + video creation
- Platform-specific formatting
- Quality self-check against brand voice before returning to Chief of Staff

**Additional Workers** (spawned when workload justifies):
- Video Specialist, Ad Manager, Analytics Analyst, Trend Spotter
- Free tier: 1 agent (Chief of Staff). Paid plans allow more sub-agents.

### Inter-Agent Communication

```
CUSTOMER (Slack / Dashboard)
  │
  │ Only talks to Chief of Staff
  ▼
CHIEF OF STAFF
  │         │
  │         │  Delegates with full context
  ▼         ▼
Research ◄───► Content
Worker        Worker

All internal. Customer sees activity in dashboard
but only chats with their Chief of Staff.
```

All communication via OpenClaw's `sessions_spawn()`. Chief of Staff provides full context in every delegation. Sub-agents learn from feedback stored in Mem0.

### Automation & Workflows (Q47)

The Chief of Staff suggests workflows and automations over time. Human approves once, then it runs automatically:
- "Every Monday, research competitors and draft 3 posts"
- "When engagement drops 20%, flag it and suggest a new content angle"
- "Auto-schedule approved posts for optimal times"

These workflows are powered by Inngest's durable execution engine.

---

## 5. Memory Architecture

### Three-Layer Memory System

PixelPort uses Mem0 managed cloud as the persistent memory layer from day one. (Q10 updated, Q51)

**Layer 1: Working Memory (Vault)**
- Markdown files in OpenClaw workspace (proven in Growth Swarm)
- Company profile, brand voice, ICP, competitors, product context
- Chief of Staff auto-manages updates (Q12)
- Humans can view/edit via dashboard

**Layer 2: Persistent Memory (Mem0)**
- Vector DB (pgvector) for semantic retrieval — "what hooks work best for our ICP?"
- Graph DB (Neo4j) for entity relationships — competitors, content performance, brand entities
- Auto-extracts facts from conversations, resolves conflicts, compresses history
- Multi-level scoping: tenant-level, agent-level, session-level
- Chief of Staff reads/writes memory via Mem0 REST API

**Layer 3: Operational Data (OpenClaw)**
- Conversation history, session logs, agent activity
- Already stored on customer droplet by OpenClaw
- Surfaced in dashboard via PixelPort API (Q11)

### Mem0 Integration

- **Deployment**: Managed cloud (faster to start, less ops). Apply for Mem0 startup program (3 months free Pro for companies under $5M funding).
- **Per-tenant isolation**: Each tenant gets a separate `user_id` scope in Mem0. Data never crosses boundaries.
- **Agent scoping**: Chief of Staff and sub-agents get separate `agent_id` scopes within the tenant.
- **Dashboard access**: Customers can view and edit their agent's memory from the Knowledge Vault page in the dashboard.
- **Cost**: $19/mo (Starter) or $249/mo (Pro with graph memory) per tenant. Included in PixelPort subscription — not a customer-facing cost.

### What the Agent Remembers
- Brand voice patterns and what content styles perform best
- Competitor landscape and positioning changes over time
- ICP engagement patterns — which topics, formats, and hooks resonate
- Founder preferences — feedback patterns, editorial style, approval tendencies
- Seasonal/temporal patterns — best posting times, industry event cycles
- Relationship graph — key people, companies, topics, and how they connect

---

## 6. User Journey & Onboarding

### Signup Flow

```
1. Land on pixelport.ai → "Start for Free" (14-day trial)
2. Sign up (Google OAuth or email magic link via Clerk)
3. Workspace created → DO Droplet provisioning starts (~60 sec)
4. Redirect to onboarding flow
```

### Onboarding: 3 Steps (Q31)

The onboarding happens inside the Lovable dashboard via a chat widget. The Chief of Staff is the conversational interface.

**Step 1: Company + Goals** (2 min)
- Customer enters company URL + primary marketing goal
- Agent auto-scans website and social profiles (Q33)
- Pre-fills brand voice, competitors, ICP, product context
- "Got it — looks like you're [summary]. That right?"

**Step 2: Personalize Your Agent** (1 min)
- Name your Chief of Staff (default: Luna)
- Upload avatar (optional)
- Set tone: Casual / Professional / Custom (Q35)
- Brief explanation of what the Chief of Staff does, the vault, and memory

**Step 3: Connect Slack** (1 min)
- One-click Slack OAuth
- Agent sends first message: "Hey team, I'm [name] — your new chief of staff. Here's what I'm working on today."
- Agent auto-runs: competitor scan + first content draft from onboarding data

**Post-Onboarding**:
- Redirect to main dashboard
- First content draft appears for approval within ~30 minutes
- Agent proposes initial KPIs based on goals (Q39 — KPI negotiation loop)

### Daily Operations

**Reporting** (Q40 — configurable frequency):
- Daily digest, weekly deep-dive, or both — customer chooses
- Reports appear in both Slack and dashboard (Q41 — stays in sync)
- Agent proposes KPIs, customer confirms, agent tracks and re-evaluates monthly (Q39)

**Content Production** (Q42 — proactive):
- Agent proactively scans trends, competitors, and vault to identify content opportunities
- Produces platform-native content packs (Q43 — fully baked with images, stats, video when relevant)
- Presents in Slack for approval
- Unlimited revisions until human approves (Q44)

**Approval Flow** (Q14 — both channels):
```
Chief of Staff → Slack thread:
"📝 New content draft — [topic]

**LinkedIn:**
---
[full post, platform-native, with image concept]
---

👍 Reply "approved" to greenlight
✏️ Reply with edits or feedback
🔄 Reply "new angle" for a different take"
```

Same pending approvals appear in dashboard. Either channel works, stays in sync via Inngest.

**Competitor Monitoring** (Q46):
- Agent proactively monitors configured competitors
- Flags moves in Slack: "Competitor X just launched a new product page — I've got 3 counter-angles ready"
- Suggests counter-content proactively

---

## 7. Content Production Pipeline

### How Content Gets Made

1. **Agent identifies opportunity** (proactive — Q42): scans trends, competitors, vault, performance data
2. **Agent produces content** (delegates to content sub-agent with detailed brief)
3. **Content pack returned**: platform-native, fully baked (Q43)
4. **Agent presents in Slack** with clean CTA (no internal notes exposed)
5. **Human approves/edits/rejects** in Slack thread or dashboard
6. **Unlimited revisions** until human approves (Q44)
7. **Approved content queued** for publishing

### What "Platform-Native" Means (Q43)

The agent doesn't follow a rigid template. It produces content that looks like it was made by a senior marketer for each specific platform. What's included depends on what the post needs:

- **LinkedIn**: Hook in first 2 lines (before "see more"), 1200-1800 chars, conversational professional tone, relevant image, 3-5 hashtags
- **X**: Punchy single (280 chars) or thread (3-5 tweets), sharp and opinionated, no hashtags in body
- **Images**: Included by default when they add value (UGC-style aesthetic, brand-aligned)
- **Video**: When the topic benefits from video (product demos, explainers, trending formats)
- **Stats**: When data points strengthen the argument
- **Hashtags**: Where appropriate for the platform

The LLM is smart enough to decide what each post needs. No human intervention required to assemble the pack.

### Social Publishing (Q7, Q8)

**Phase 1-2**: Assisted publish only. Agent produces ready-to-post packages. Structured Slack approval threads with content + media + CTA options. Dashboard shows pending approvals.

**Phase 3+**: Manual posting. Agent produces fully formatted content including media. Human copies to platform. Full auto-posting via integration added later.

**Future**: Graduated auto-post — unlock auto-publishing per customer after trust is earned.

---

## 8. Feature Specification

### 8.1 Core Features (MVP)

#### F1: Chief of Staff Chat Interface
- **Web**: Chat widget (persistent bottom-right) + full-page chat view (Q37 — both)
- **Slack**: Bot in workspace (primary ongoing channel)
- Conversational — not command-based
- Agent pitches with reasoning, waits for confirmation on significant actions
- Autonomy: researches and drafts without asking; approval only for publishing and emails (Q45)

#### F2: Agent Dashboard
- Agent status card: name, status, current task, next scheduled task
- Sub-agent activity visible (research, content production in progress)
- Pause/Resume toggle
- Edit agent: name, avatar, tone, memory
- Session history: tasks run, duration, cost

#### F3: Content Pipeline
- **Drafts**: Work-in-progress
- **In Review**: Waiting for human approval (surfaces in Slack + dashboard)
- **Approved**: Ready to publish
- **Published**: Live + performance tracking
- Each piece shows: platform, format, media, creation date, approval status

#### F4: Approval Workflow (Inngest-powered)
- Content surfaces in dashboard + Slack simultaneously (Q14)
- One-click: Approve / Edit / Reject
- Unlimited revision cycles (Q44)
- Inngest manages durable state: approval pending → human response → next step

#### F5: Competitor Intelligence
- Agent auto-scans configured competitors (from onboarding)
- Dashboard section: competitor cards with latest activity
- Proactive Slack alerts when competitors launch campaigns or change positioning (Q46)
- Historical tracking

#### F6: Performance & KPIs
- **KPI negotiation**: Agent proposes KPIs, human confirms, agent tracks and re-evaluates monthly (Q39)
- **Content metrics**: Engagement, reach, clicks per post
- **Agent metrics**: Sessions, cost, tasks completed
- **Self-optimization**: Agent queries PostHog via MCP to learn what works (Q17)
- Reports in Slack + dashboard (Q41), configurable frequency (Q40)

#### F7: Content Calendar
- Visual calendar: scheduled posts, drafts, ideas
- Drag-and-drop reschedule
- Agent suggests optimal posting times based on performance data
- Color-coded by platform

#### F8: Knowledge Vault (Dashboard)
- View/edit agent's working memory (vault files)
- View Mem0 memory entries (what the agent has learned)
- Human can correct/delete memory entries
- Agent auto-manages updates, humans have override access (Q12)

#### F9: BYO LLM Keys + Budget Control
- **Default**: PixelPort provides LLM keys for instant start (Q4). Cost included in subscription.
- **BYO keys**: Customers can add their own keys for any provider via dashboard
- **LiteLLM routing**: All calls go through LiteLLM — budget caps, multi-provider support, metering (Q6)
- **Budget alerts**: When limit approached, agent tells user explicitly: "Budget hit — switching to cheaper model unless you add keys or increase budget" (Q5)
- Per-agent cost tracking

#### F10: Brand Voice Enforcement
- Voice guide stored in vault (auto-populated from onboarding website scan)
- Agent enforces across all content: every draft checked against voice guide
- Agent flags deviations before presenting to human

### 8.2 Advanced Features (Post-MVP)

#### F11: Proactive Workflow Suggestions (Q47)
- Agent spots patterns: "Posts with polls get 2x engagement"
- Suggests automated workflows: "Every Monday, research rivals, draft 3 posts"
- Human approves once → Inngest runs it automatically
- Visible in dashboard as "Active Workflows"

#### F12: Image Generation
- Default model included; customers configure providers via dashboard (Q22)
- Supported providers: FLUX.2 Pro, Google Imagen 4, GPT Image, DALL-E, Midjourney
- BYO API keys override defaults
- Agent decides when images add value — not every post needs one

#### F13: Video Generation
- Included because GTM without video is incomplete (Q23)
- Supported providers: Runway Gen-4, Sora, Google Veo, HeyGen
- Configurable via dashboard, BYO keys
- Agent writes scripts + generates via configured provider

#### F14: Email Marketing
- AgentMail default for all tenants (Q19). Gmail/Outlook optional for enterprise.
- Ships in Phase 1 — email is core to a chief of staff (Q20)
- Approval required for all outbound emails (Q21)
- Drip campaigns, launch sequences, newsletters via content sub-agent

#### F15: OpenClaw Direct Access
- "Open Control UI" button for power users
- Raw OpenClaw dashboard access
- Terminal access to agent

#### F16: Audit Log
- Every action logged: who, what, when, why
- Filterable by agent, action type, date
- Ships in Phase 4 (Q18)

#### F17: Team Management
- Invite members, assign roles (Admin / Member / Viewer)
- Ships in Phase 4 (Q18)

---

## 9. Dashboard UI Specification

All dashboard pages built in **Lovable** for rapid shipping. (Q36)

### 9.1 Navigation (Left Sidebar)

```
[PixelPort Logo]

Home (Dashboard)
Content Pipeline
Content Calendar
Performance
Knowledge Vault
Competitor Intel
Connections
Settings
  └─ API Keys & Models
  └─ Budget Controls
  └─ Integrations
  └─ Team
  └─ Audit Log

[Agent Chat Widget — persistent bottom-right]
[Agent Full Page Chat — via nav]
[User Profile — bottom-left]
```

### 9.2 Home / Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Good afternoon, Sanchal                                     │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Agent    │ │ Running  │ │ Sessions │ │ Monthly  │      │
│  │ Status   │ │ Tasks    │ │  Today   │ │  Cost    │      │
│  │  🟢 Active│ │    2     │ │   14     │ │  $12.50  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                              │
│  ── Your Chief of Staff ─────────────────────────────       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 🟢 Luna (Chief of Staff) · Active · 2m ago       │      │
│  │    Current: Reviewing content draft               │      │
│  │    Next: Daily digest at 6:00 PM                  │      │
│  │    Sub-agents: 1 researching, 1 idle              │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
│  ── Pending Approvals (2) ─────────────────────────────     │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │ LinkedIn Post: "3 things competitors won't..."    │      │
│  │ Ready to post · Image attached                    │      │
│  │ [✅ Approve] [✏️ Edit] [❌ Reject]                │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
│  ── Quick Stats (Last 7 Days) ────────────────────────      │
│  [Posts: 12 | Reach: 8.4K | Engagement: 340 | Leads: 23]   │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Content Pipeline Page

Kanban-style: Drafts → In Review → Approved → Published
Each card shows: platform icon, title/hook, media thumbnail, status, date

### 9.4 Content Calendar Page

Visual weekly/monthly view. Drag-drop to reschedule. Color-coded by platform. Shows scheduled, drafts, ideas.

### 9.5 Performance Page

- Time range selector (7d / 30d / 90d)
- KPI tracking against negotiated targets (Q39)
- Engagement charts, funnel visualization
- Top performing content
- Agent cost breakdown
- Competitor comparison

### 9.6 Knowledge Vault Page

- View vault files (brand voice, ICP, competitors, etc.)
- View/edit Mem0 memory entries
- See what the agent has learned over time
- Delete or correct entries

### 9.7 Settings Pages

- **API Keys & Models**: BYO LLM keys (Anthropic, OpenAI, Google, xAI, Groq, Mistral, etc.), image/video gen provider keys, model selection per agent
- **Budget Controls**: Monthly cap, daily alert threshold, auto-downgrade behavior (Q5)
- **Integrations**: Slack, AgentMail, social platforms, CRM, analytics
- **Team**: Invite members, roles (Admin/Member/Viewer)
- **Audit Log**: Action history, filterable

---

## 10. Integrations & Connections

### Phase 1 (MVP)

| Integration | Type | Agent Access |
|------------|------|-------------|
| Slack | Primary comms | Chief of Staff |
| AgentMail | Email (default) | Chief of Staff |
| PostHog | Analytics | Chief of Staff (via MCP) |
| LiteLLM | LLM routing | All agents |
| Mem0 | Memory | All agents |

### Phase 2

| Integration | Type | Agent Access |
|------------|------|-------------|
| Image gen (FLUX, Imagen, GPT Image) | Media | Content sub-agent |
| Google Workspace | Workspace | Chief of Staff |

### Phase 3

| Integration | Type | Agent Access |
|------------|------|-------------|
| X (Twitter) | Social (read + assisted publish) | Chief of Staff |
| LinkedIn | Social (read + assisted publish) | Chief of Staff |
| Video gen (Runway, Sora, Veo, HeyGen) | Media | Content sub-agent |

### Phase 4+

| Integration | Type | Agent Access |
|------------|------|-------------|
| HubSpot / Salesforce | CRM | Chief of Staff |
| WhatsApp / Telegram | Comms | Chief of Staff |
| Gmail/Outlook (optional) | Email (enterprise) | Chief of Staff |
| Notion | Docs | All |

### Integration Architecture

OAuth 2.0 where available. API keys as fallback. Credentials stored encrypted per-tenant in Supabase, injected into OpenClaw instance at runtime.

---

## 11. Infrastructure & Deployment

### Per-Customer Instance (Q1)

Each PixelPort customer gets:
- **1 DigitalOcean Droplet** running OpenClaw (pinned explicit version tag, never `:latest`)
- Isolated filesystem (workspace per agent)
- Own API keys, credentials, memory (Mem0 scoped to tenant)
- AgentMail inbox provisioned automatically
- Gateway accessible only via PixelPort API (not public)
- Slack Socket Mode connection (Q3 — per-tenant for now)

### Provisioning Flow (Inngest-powered)

```
User signs up (Clerk)
  → Inngest workflow triggered
  → Create tenant record in Supabase
  → Provision DO Droplet from snapshot/image
  → Deploy OpenClaw container (pinned tag)
  → Inject: SOUL.md (parameterized with onboarding data), API keys, AgentMail inbox
  → Configure LiteLLM routing for tenant
  → Create Mem0 tenant scope
  → Connect Slack (if OAuth completed)
  → Health check: verify gateway responds
  → Mark tenant "active" in Supabase
  → Onboarding chat begins
```

### LLM Key Management (Q4)

- **Default**: PixelPort provides LLM keys for all tenants (lower onboarding friction)
- **BYO**: Customers can add their own keys via dashboard — routes through LiteLLM
- **Budget**: LiteLLM enforces per-tenant budget caps. When hit, agent explicitly tells user (Q5)
- **Cost**: PixelPort absorbs LLM cost for trial period; included in paid subscription tier

### Scaling Strategy

**Phase 1 (0-50 customers)**: Single DO region. Manual provisioning. Shared LiteLLM + PostHog instances.

**Phase 2 (50-500 customers)**: Automated provisioning via Inngest. Multi-region DO. Auto-scaling LiteLLM.

**Phase 3 (500+ customers)**: K8s on AWS EKS. Auto-provisioning, auto-scaling, auto-healing.

### Cost Estimates (Per Customer)

| Component | Monthly Cost |
|-----------|-------------|
| DO Droplet ($24 basic) | ~$24-48 |
| LLM API (PixelPort-provided keys) | ~$20-50 (depends on usage) |
| Mem0 managed cloud | ~$19-249 (included in subscription) |
| AgentMail | Free tier (3 inboxes, 3K emails/mo) |
| Storage | ~$1 |
| **Total per customer** | **~$65-150/month** |

At $299/mo Starter pricing, unit economics are positive from day one.

---

## 12. Data, Privacy & Security

### Data Retention
- All agent data persists on customer's isolated droplet (Q11)
- Mem0 memory persists until deleted
- Memory compresses over time (key learnings kept, noise discarded)
- Offboarding: archive 30 days, then auto-delete
- Customers can export all data at any time

### Privacy
- Droplet isolation: customer data never crosses boundaries (Q1)
- Mem0 scoped per tenant — no cross-tenant leakage
- OAuth tokens encrypted at rest (Supabase)
- No training on customer data
- GDPR/CCPA compliant data handling

### Security (Q25, Q26, Q27)
- Each customer = isolated droplet
- Network isolation (droplets can't talk to each other)
- API authentication via tokens (per-tenant)
- **Skills**: Curated allowlist only — PixelPort pre-vets skills, customers can only use approved ones (Q25)
- **Hardening**: VM isolation is sufficient for now. Full security hardening (sandbox mode, tool allowlists) before enterprise customers (Q26)
- **Token rotation**: Case by case for now, formalize before enterprise (Q27)
- Audit log ships in Phase 4 (Q18)

---

## 13. Pricing & GTM

### Pricing Model (Q28, Q29, Q30)

Transparent pricing on website from day one (Q29).

| Plan | Price | What's Included |
|------|-------|----------------|
| **Starter** | $299/month | 1 AI employee (Chief of Staff), default LLM keys, AgentMail, Slack integration, content pipeline, competitor monitoring, daily reports |
| **Pro** | $999/month | 3 AI employees (Chief of Staff + 2 specialists), BYO keys support, priority support, advanced analytics, workflow automation |
| **Enterprise** | $3,000+/month | Unlimited agents, dedicated infrastructure, custom integrations, SLA, compliance features |

**14-day free trial** with full features, capped LLM budget (Q30).

### GTM Motion (Q48)

**Hybrid**: Self-serve signup for Starter (product-led growth), sales-assisted for Pro and Enterprise.

### Positioning (Q49)

**"Your AI Chief of Staff"** — employee framing. Not another marketing tool, an AI employee that runs your marketing.

### Launch Distribution (Q50)

Organic-first:
- Launch on X/LinkedIn + Product Hunt + YC community
- Luna runs PixelPort's own marketing (dogfood)
- Founder-led content about the build journey
- No paid ads initially

---

## 14. Team & Work Split

### Two Parallel Workstreams

**Stream A: Frontend (Founder + Claude in claude.ai)**
- All Lovable pages: landing, onboarding, dashboard, content pipeline, calendar, performance, settings
- UX flows, component design, responsive layout
- Supabase schema design (shared DB — Lovable Cloud provisions this)
- Clerk auth integration
- Lovable Cloud deploys to GitHub automatically — shared repo

**Stream B: Backend + Infrastructure (CTO Claude Code + Codex)**
- OpenClaw provisioning pipeline (DO Droplet per tenant)
- LiteLLM gateway deployment and per-tenant routing
- Inngest workflow functions (approvals, scheduling, onboarding state machine)
- Mem0 integration (tenant scoping, agent memory API)
- PostHog setup + MCP server for agent queries
- AgentMail tenant inbox provisioning
- PixelPort API → OpenClaw gateway bridge
- Agent SOUL.md parameterized templates + auto-injection
- Security hardening, monitoring, health checks
- **Integration with Lovable frontend** — CTO connects API endpoints to Lovable-built UI

### Shared Resources (Both Streams Access)
- **GitHub repo**: Lovable Cloud auto-deploys here; CTO/Codex push backend code to same repo
- **Supabase**: Lovable Cloud provisions the database; both streams read/write the same schema
- **Vercel**: Frontend deploys via Lovable → GitHub → Vercel; API routes added by CTO

### Coordination Protocol
- Master plan (this doc) is source of truth for what to build
- Founder designs frontend pages in Lovable, shares screenshots/links with CTO
- CTO writes API endpoints that Lovable pages consume
- Schema changes coordinated via Supabase migrations in shared repo
- CTO instructions doc generated per slice (same pattern as Growth Swarm phases)

---

## 15. Build Phases

### Phase 0: Foundation (Weeks 1-2)
**Goal**: Web app shell + provisioning pipeline

- [ ] 0.1: Lovable project setup + Clerk auth + Supabase DB
- [ ] 0.2: Landing page (pixelport.ai) — pricing, "Start for Free" CTA
- [ ] 0.3: Auth flow: signup → workspace creation → dashboard redirect
- [ ] 0.4: Provisioning: spin up DO Droplet + OpenClaw per user (Inngest workflow)
- [ ] 0.5: API bridge: PixelPort API → OpenClaw gateway communication
- [ ] 0.6: LiteLLM central deployment + per-tenant routing
- [ ] 0.7: Dashboard shell in Lovable (nav, empty states)
- [ ] 0.8: DB schema: tenants, agents, sessions, metrics

**Deliverable**: User signs up, droplet spins up, they see an empty dashboard.

### Phase 1: Chief of Staff Alive (Weeks 3-5)
**Goal**: Onboarding + Chief of Staff working in dashboard + Slack + email

- [ ] 1.1: 3-step onboarding chat widget (URL + goals + connect Slack)
- [ ] 1.2: Agent auto-scans website during onboarding (Q33)
- [ ] 1.3: SOUL.md parameterized template (name, avatar, tone, company data)
- [ ] 1.4: Auto-provision Chief of Staff in OpenClaw from onboarding data
- [ ] 1.5: Agent personalization: name, avatar, tone selection (Q35)
- [ ] 1.6: Dashboard: Home page with agent status, pending approvals
- [ ] 1.7: Chat widget (persistent) + full-page chat view (Q37)
- [ ] 1.8: Slack integration: one-click OAuth
- [ ] 1.9: AgentMail provisioning per tenant (Q19, Q20)
- [ ] 1.10: Mem0 tenant setup + Chief of Staff memory integration
- [ ] 1.11: PostHog integration (agent queries via MCP — Q17)
- [ ] 1.12: KPI negotiation flow: agent proposes, human confirms (Q39)
- [ ] 1.13: Configurable reporting cadence (Q40)
- [ ] 1.14: Reports in Slack + dashboard (Q41)

**Deliverable**: Customer onboards in 3 steps, Chief of Staff is alive in Slack + dashboard + email. Reports daily. Proposes KPIs.

### Phase 2: Content Pipeline + Images (Weeks 6-9)
**Goal**: Full content production pipeline with image generation

- [ ] 2.1: Content sub-agent auto-provisioning
- [ ] 2.2: Research sub-agent auto-provisioning
- [ ] 2.3: Inter-agent communication (Chief of Staff ↔ sub-agents)
- [ ] 2.4: Content pipeline UI in Lovable (drafts → review → approved → published)
- [ ] 2.5: Approval workflow: Slack threads + dashboard buttons (Inngest-powered, Q14)
- [ ] 2.6: Platform-native content production (Q43)
- [ ] 2.7: Image generation integration (FLUX, Imagen, GPT Image — Q22, Q24)
- [ ] 2.8: Competitor intelligence dashboard (Q46)
- [ ] 2.9: Content calendar UI
- [ ] 2.10: Knowledge Vault page (view/edit vault + Mem0 entries)

**Deliverable**: Full content pipeline. Agent researches, writes, generates images, QAs, presents for approval. All visible in dashboard.

### Phase 3: Social Publishing + Video (Weeks 10-12)
**Goal**: Social integrations + video generation

- [ ] 3.1: X integration (read + assisted publish — Q7, Q8, Q9)
- [ ] 3.2: LinkedIn integration (read + assisted publish)
- [ ] 3.3: Video generation integration (Runway, Sora, Veo, HeyGen — Q23)
- [ ] 3.4: Scheduling engine: approved content auto-posts at scheduled time
- [ ] 3.5: Performance tracking from social APIs
- [ ] 3.6: Weekly performance report with social data

**Deliverable**: End-to-end: research → write → image/video → approve → publish → track.

### Phase 4: Dashboard Polish + Trust (Weeks 13-16)
**Goal**: Production-quality dashboard, trust features

- [ ] 4.1: Performance page (charts, funnel, KPI tracking — Q39)
- [ ] 4.2: Agent detail page (config, chat, terminal tabs)
- [ ] 4.3: Connections page
- [ ] 4.4: API Keys management (multi-provider — Q22, Q23)
- [ ] 4.5: Budget controls with LiteLLM integration (Q5, Q6)
- [ ] 4.6: Brand voice enforcement UI
- [ ] 4.7: Audit log (Q18)
- [ ] 4.8: Team management + RBAC (Q18)
- [ ] 4.9: OpenClaw direct access button
- [ ] 4.10: Proactive workflow suggestions UI (Q47)
- [ ] 4.11: Stripe billing integration (Q28)

**Deliverable**: Full-featured dashboard. Billing live. Enterprise-ready trust features.

### Phase 5: Growth (Weeks 17-20)
**Goal**: Advanced features, scale

- [ ] 5.1: WhatsApp integration
- [ ] 5.2: CRM integrations (HubSpot, Salesforce)
- [ ] 5.3: Gmail/Outlook optional for enterprise (Q19)
- [ ] 5.4: Google Workspace integration
- [ ] 5.5: Agent marketplace / custom agent creation
- [ ] 5.6: Multi-team views
- [ ] 5.7: Advanced analytics (attribution, A/B testing)

### Phase 6: Scale (Weeks 21+)
**Goal**: Production hardening, compliance

- [ ] 6.1: K8s migration
- [ ] 6.2: Auto-provisioning at scale
- [ ] 6.3: Security hardening (sandbox mode, tool allowlists — Q26)
- [ ] 6.4: Token rotation policy formalized (Q27)
- [ ] 6.5: SOC2 readiness
- [ ] 6.6: Centralized Slack ingestion (replace Socket Mode — Q3)

---

## 16. Growth Swarm Migration

Growth Swarm (Vidacious deployment) becomes PixelPort's first customer.

### What Stays
- OpenClaw as runtime
- LUNA / SCOUT / SPARK agent architecture (maps to Chief of Staff + sub-agents)
- File-based handoffs, Slack integration, inter-agent communication
- SOUL.md, vault patterns

### What Changes
- **Infrastructure**: Single DO droplet → PixelPort-provisioned instance
- **Dashboard**: Raw OpenClaw UI → Lovable purpose-built dashboard
- **Memory**: Vault-only → Vault + Mem0
- **LLM routing**: Direct API → LiteLLM gateway
- **Workflows**: Cron → Inngest
- **Analytics**: Manual → PostHog with agent MCP access

### Migration Path
1. Growth Swarm continues on current droplet during PixelPort development
2. Phase 1 complete → provision Vidacious as first tenant
3. Migrate SOUL.md, vault content, Mem0 seed data to new instance
4. Connect existing Slack workspace to PixelPort
5. Verify agent behavior matches
6. Decommission old droplet

### Growth Swarm Progress That Transfers

| Component | Status | PixelPort Reuse |
|-----------|--------|-----------------|
| Agent SOUL.md files | Tested + production-ready | Template source for all tenants |
| Slack integration | Working | Connection config pattern |
| Web search (Gemini) | Working | Provisioning auto-configures |
| Inter-agent mesh | Verified (native spawn) | Phase 2 implementation |
| Vault (5-file evidence-based) | Live, Luna-managed | Default vault template + Mem0 seed |
| TOOLS.md (vault mgmt, email, skills) | Complete | Template source |
| AgentMail | Active (vidacious@agentmail.to) | Default email for all tenants |
| Content pipeline (G5) | Live, first packs produced | Phase 2 foundation |
| ANNOUNCE_SKIP pattern | Working | Clean content presentation |

---

## 17. Decisions Log

All 52 decisions from the Q&A sessions plus prior Growth Swarm decisions.

### Infrastructure & Architecture (Q1-Q3)

| # | Decision | Choice |
|---|----------|--------|
| Q1 | VM isolation model | One full DigitalOcean droplet per customer (strongest isolation) |
| Q2 | Control plane split | Hybrid: PixelPort web+API on Vercel/serverless, customer OpenClaw on dedicated droplets |
| Q3 | Slack routing | Socket Mode per tenant VM for now; centralize later |

### LLM & Budget (Q4-Q6)

| # | Decision | Choice |
|---|----------|--------|
| Q4 | Default LLM keys | PixelPort provides default keys (lower friction) |
| Q5 | Budget limit behavior | Explicit: Luna tells user, suggests cheaper model or adding keys |
| Q6 | LiteLLM gateway | Yes — deploy from day one, all agents route through it |

### Social Publishing (Q7-Q9)

| # | Decision | Choice |
|---|----------|--------|
| Q7 | Publishing approach | Assisted publish only — structured Slack approval threads + dashboard pending actions |
| Q8 | Auto-post | Manual posting for now, automate later |
| Q9 | Publishing phase | Phase 3 (weeks 10-12) as planned |

### Memory (Q10-Q12, Q51)

| # | Decision | Choice |
|---|----------|--------|
| Q10 | Memory sophistication | Vault + Mem0 from day one (updated by Q51) |
| Q11 | Event archive | No separate archive — surface existing OpenClaw data via API |
| Q12 | Vault ownership | Luna auto-manages, humans can view/edit via dashboard |
| Q51 | Mem0 deployment model | Managed cloud (faster to start, $19-249/mo per tenant) |

### Workflows (Q13-Q15)

| # | Decision | Choice |
|---|----------|--------|
| Q13 | Workflow engine | Inngest from day one (free: 50K executions/mo) |
| Q14 | Approval location | Both Slack threads AND dashboard (stays in sync) |
| Q15 | Onboarding start | Hybrid: dashboard widget first, then Slack after connecting |

### Analytics & Trust (Q16-Q18)

| # | Decision | Choice |
|---|----------|--------|
| Q16 | Analytics platform | PostHog (free: 1M events + 100K LLM events) |
| Q17 | Agent self-optimization | Yes — Luna queries PostHog via MCP |
| Q18 | Audit log / RBAC timing | Phase 4 (polish after core features work) |

### Email (Q19-Q21)

| # | Decision | Choice |
|---|----------|--------|
| Q19 | Email platform | AgentMail default, Gmail/Outlook optional for enterprise |
| Q20 | Email timing | Phase 1 — email is core to a chief of staff |
| Q21 | Outbound email approval | Always require approval |

### Media Generation (Q22-Q24)

| # | Decision | Choice |
|---|----------|--------|
| Q22 | Image gen provider | Default model included; customers configure via dashboard, BYO keys |
| Q23 | Video gen | Included (Runway, Sora, Veo, HeyGen) — configurable, BYO keys |
| Q24 | Image gen timing | Phase 2 (with content pipeline) |

### Security (Q25-Q27)

| # | Decision | Choice |
|---|----------|--------|
| Q25 | OpenClaw skills | Curated allowlist only — PixelPort pre-vets |
| Q26 | Security hardening | Ship fast now, full hardening before enterprise customers |
| Q27 | Token rotation | Case by case for now |

### Pricing (Q28-Q30)

| # | Decision | Choice |
|---|----------|--------|
| Q28 | Pricing model | Per-agent: Starter $299, Pro $999, Enterprise $3K+ |
| Q29 | Pricing visibility | Transparent on website from day one |
| Q30 | Free trial | 14-day free trial with full features, capped LLM budget |

### Onboarding & Agent Model (Q31-Q35)

| # | Decision | Choice |
|---|----------|--------|
| Q31 | Onboarding steps | 3-step: URL + goals + connect Slack (Luna auto-scans the rest) |
| Q32 | Agent team model | Luna is THE product (Chief of Staff); sub-agents work behind scenes |
| Q33 | Website auto-scan | Yes — auto-scan website + social profiles during onboarding |
| Q34 | Agent visibility | Luna primary; sub-agents visible in dashboard activity but not interacted with |
| Q35 | Agent personalization | Name, avatar, tone (casual/professional/custom) |

### Dashboard (Q36-Q38)

| # | Decision | Choice |
|---|----------|--------|
| Q36 | Dashboard pages | All Tensol-equivalent pages + GTM additions, all in Lovable |
| Q37 | Luna chat UI | Both: persistent widget + full-page chat |
| Q38 | Page priority | All pages ship, ordered by phase |

### KPIs & Reporting (Q39-Q41)

| # | Decision | Choice |
|---|----------|--------|
| Q39 | KPI setting | Negotiation loop: Luna proposes, human confirms, monthly re-evaluation |
| Q40 | Reporting cadence | Configurable (daily/weekly/both) |
| Q41 | Report location | Slack message + dashboard widget (both, stays in sync) |

### Content Pipeline (Q42-Q44)

| # | Decision | Choice |
|---|----------|--------|
| Q42 | Content initiation | Luna proactive — scans trends, competitors, vault, proposes angles |
| Q43 | Content pack format | Platform-native, fully baked (images, stats, video, hashtags as needed) |
| Q44 | Revision cycles | Unlimited until human approves |

### Autonomy (Q45-Q47)

| # | Decision | Choice |
|---|----------|--------|
| Q45 | Autonomous actions | Research + draft autonomously; approval only for publishing + outbound emails |
| Q46 | Competitor monitoring | Proactive — monitors, flags moves, suggests counter-content |
| Q47 | Automation level | Luna suggests workflows, human approves once, then it runs |

### GTM (Q48-Q50)

| # | Decision | Choice |
|---|----------|--------|
| Q48 | GTM motion | Hybrid: self-serve Starter, sales for Pro/Enterprise |
| Q49 | Positioning | "Your AI Chief of Staff" |
| Q50 | Launch distribution | Organic: X/LinkedIn + Product Hunt + YC community |

### Prior Growth Swarm Decisions (carried forward)

| Decision | Choice |
|----------|--------|
| Docker image policy | Stock upstream OpenClaw only, explicit version tags |
| Search provider | Gemini (validated) |
| Agent model | openai/gpt-5.1-codex for all agents |
| Email trust boundary | Allowlisted domains only |
| Data source-of-truth | Workspace files only |
| Human entrypoint | Chief of Staff only in Slack |
| Founder approval | Required before publishing |

---

## 18. Open Questions

| # | Question | Impact | Needs Answer By |
|---|----------|--------|----------------|
| 1 | Domain: pixelport.ai or alternative? | Landing page | Phase 0 |
| 2 | Mem0 startup program application — submit now? | Cost ($249/mo saved for 3 months) | Immediate |
| 3 | Which DO region for customer droplets? | Latency, compliance | Phase 0 |
| 4 | Instagram API: Facebook app review timeline? | Integration scope | Phase 3+ |
| 5 | Legal: ToS and privacy policy | Compliance | Phase 1 |
| 6 | Lovable project structure — monorepo or separate apps? | Dev workflow | Phase 0 |

---

## Appendix A: Tensol Feature Parity Checklist

Everything Tensol offers that PixelPort must match (baseline), plus PixelPort additions.

### Tensol Baseline (must match)

- [Phase 0] Signup + workspace creation
- [Phase 0] Isolated OpenClaw instance per customer
- [Phase 1] Agent management (create, configure, start/stop)
- [Phase 1] SOUL.md / persona configuration
- [Phase 1] Model selector (multi-provider via LiteLLM)
- [Phase 1] Heartbeat toggle
- [Phase 4] Multi-provider API keys
- [Phase 4] Templates gallery
- [Phase 1] Slack integration
- [Phase 4] Contact methods: Discord, Google Chat, MS Teams, Telegram, WhatsApp
- [Phase 4] Integrations
- [Phase 4] OpenClaw Built-in tools access
- [Phase 4] "Open Control UI"
- [Phase 0] Dashboard stats
- [Phase 4] Audit Log
- [Phase 4] Team management
- [Phase 0] Agent chat + terminal

### PixelPort Additions (differentiators)

- [Phase 1] 3-step conversational onboarding with auto website scan
- [Phase 1] Agent personalization (name, avatar, tone)
- [Phase 1] Persistent Mem0 memory
- [Phase 1] AgentMail email integration
- [Phase 1] KPI negotiation loop
- [Phase 1] Configurable reporting (Slack + dashboard)
- [Phase 1] PostHog analytics with agent MCP access
- [Phase 2] Multi-agent collaboration (behind scenes)
- [Phase 2] Content pipeline UI
- [Phase 2] Approval workflow (Slack + dashboard via Inngest)
- [Phase 2] Image generation
- [Phase 2] Competitor intelligence dashboard
- [Phase 2] Content calendar
- [Phase 2] Knowledge Vault (view/edit memory)
- [Phase 3] Social publishing (X + LinkedIn)
- [Phase 3] Video generation
- [Phase 4] Performance dashboard with KPI tracking
- [Phase 4] Brand voice enforcement
- [Phase 4] Budget controls with LiteLLM
- [Phase 4] Proactive workflow suggestions

---

## Appendix B: Agent SOUL.md Template

Default template injected during provisioning. Parameterized with onboarding data.

```markdown
# {AGENT_NAME} — Your Chief of Staff

## Identity
You are {AGENT_NAME}, the chief of staff for {COMPANY_NAME}'s marketing team.
You hold all business context. You decide WHAT to create, WHO it's for, and WHY
it matters. You spin up sub-agents to execute research, content, and analysis.

You are {TONE_DESCRIPTION}. You think like the founder — you know their voice,
their priorities, their instincts. When in doubt, you ask.

## Company Context
- **Company**: {COMPANY_NAME} — {COMPANY_DESCRIPTION}
- **Brand Voice**: {BRAND_VOICE}
- **Target Audience**: {TARGET_AUDIENCE}
- **Competitors**: {COMPETITORS}
- **Primary Platforms**: {PLATFORMS}
- **Goals This Quarter**: {GOALS}

## You ALWAYS
- Scope every task before delegating
- Write detailed briefs with exactly the context sub-agents need
- QA every draft against the brief + brand voice before showing the founder
- Report at the cadence the founder chose ({REPORT_CADENCE})
- Log what works and what fails in Mem0
- Look for work proactively — scan trends, competitors, opportunities
- Pitch ideas with reasoning, then wait for approval
- Keep it {TONE} — never spam, never nag

## You NEVER
- Publish anything without human approval (unless auto-post is ON)
- Send emails without human approval
- Spend budget without human approval
- Make crisis/PR decisions autonomously
- Expose internal file paths, agent names, or technical details to humans

## Autonomous Actions (no approval needed)
- Research competitors and trends
- Draft content (present for approval before publishing)
- Update vault and memory
- Delegate to sub-agents
- Query analytics (PostHog)
- Scan for opportunities

## Approval Required
- Publishing any content
- Sending any outbound email
- Accepting/rejecting significant budget changes
- Crisis/PR responses

## KPI Protocol
- At onboarding, propose 3-5 KPIs based on the founder's goals
- Track weekly, report at chosen cadence
- Re-evaluate monthly: "These KPIs are still relevant because..." or "I suggest changing X to Y because..."

## Content Production
- Identify opportunities proactively (don't wait to be asked)
- Produce platform-native content — what each post needs (images, video, stats, hashtags)
- Present in Slack with clean CTA: approved / edits / new angle
- Unlimited revisions — keep going until the founder is happy

## QA Protocol
When reviewing content from sub-agents:
1. Check against brief (audience, angle, format, CTA)
2. Check against brand voice guide
3. Check factual accuracy (all stats sourced?)
4. Check platform fit (right length, format, conventions?)
5. Never show internal notes to humans — only present polished content
```

---

*End of PixelPort Master Plan v2.0*
