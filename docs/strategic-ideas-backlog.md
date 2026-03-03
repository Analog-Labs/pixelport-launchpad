# PixelPort — Strategic Improvement Ideas Backlog

> Ideas from CTO competitive research (2026-03-03). Founder reviews and approves/rejects individually. None are blocking Phase 1.

---

## 1. "5-Minute Value" Onboarding

**Description:** During onboarding, after the user provides their company URL, the agent immediately scrapes the site and produces a quick-win deliverable — e.g., a 30-second competitor snapshot, a headline suggestion, or a brand tone analysis. The user sees LUNA working within the first 5 minutes of signup, before provisioning is even complete.

**Rationale:** Competitors like Jasper and Copy.ai hook users in the first session by generating output immediately. Most AI SaaS churn happens in the first 48 hours when users don't see value. Showing the agent's intelligence during onboarding dramatically improves activation rates.

**Effort:** Medium (requires a lightweight LLM call during onboarding, before the full OpenClaw instance is provisioned — could use the central LiteLLM gateway directly)

**Recommended timing:** Phase 1 enhancement (after core onboarding works)

**Status:** ⬜ Pending founder review

---

## 2. Predictable Pricing Messaging — "No Credits. No Surprises."

**Description:** Position PixelPort's pricing against the confusing credit/token systems used by competitors. Landing page and onboarding should emphasize: flat monthly fee, unlimited agent interactions, transparent LLM budget dashboard (already built in Phase 0 settings/budget endpoint).

**Rationale:** Jasper, Writesonic, and Copy.ai all use credit-based pricing that frustrates users. "How many credits will this cost?" is a top complaint in reviews. PixelPort's flat-fee model ($299/$999/$3K) is a genuine differentiator but needs to be marketed explicitly.

**Effort:** Low (copy changes on landing page + pricing section)

**Recommended timing:** Phase 1 (when landing page pricing section is finalized)

**Status:** ⬜ Pending founder review

---

## 3. Agent Observability Dashboard — "What Did LUNA Do Today?"

**Description:** A daily activity summary in the dashboard showing: messages processed, research completed, content drafted, decisions pending, budget consumed. Think of it as a "daily standup report" from the AI agent. Could also be delivered in Slack.

**Rationale:** Trust is the #1 barrier to AI agent adoption. Users need to see what the agent is doing autonomously. Competitors like Lindy.ai and Relevance AI have observability as a core feature. This also differentiates from simple chatbot products — PixelPort's agent is proactive, and users should see proof.

**Effort:** Medium (requires PostHog event aggregation + a new dashboard widget + Slack summary)

**Recommended timing:** Phase 1-2 (after PostHog instrumentation, 1.C5)

**Status:** ⬜ Pending founder review

---

## 4. AI Search Visibility (GEO) — Track Brand in AI Answers

**Description:** Add a "Generative Engine Optimization" feature where SCOUT monitors how the customer's brand appears in AI-generated answers (ChatGPT, Gemini, Perplexity). Dashboard shows: "Your brand was mentioned in X% of relevant AI queries this week."

**Rationale:** This is an emerging category (2025-2026) that no major competitor has productized yet. AI search visibility is becoming as important as SEO. First-mover advantage is massive. It directly ties to SCOUT's existing research capabilities.

**Effort:** High (requires building a GEO monitoring pipeline — periodic queries to AI engines + response analysis)

**Recommended timing:** Phase 2-3 (after core product is stable)

**Status:** ⬜ Pending founder review

---

## 5. Trust Badge + SOC 2 Roadmap

**Description:** Add a visible "Security" section to the landing page and dashboard. Even before SOC 2 certification, show: data isolation (one droplet per customer), encryption at rest, no training on customer data, GDPR-ready architecture. Create a public security page (like linear.app/security).

**Rationale:** Enterprise buyers ($3K+ plan) require security assurance. Having a public security posture page from day 1 — even without SOC 2 — signals maturity. It's a low-effort trust signal that pays dividends in sales conversations.

**Effort:** Low (landing page section + a /security page with architecture overview)

**Recommended timing:** Phase 1 (landing page security section) + Phase 4 (SOC 2 roadmap)

**Status:** ⬜ Pending founder review

---

## How to Use This File

1. Founder reviews each idea above
2. Change status to ✅ Approved, ❌ Rejected, or 🔄 Deferred
3. Approved ideas get added to the appropriate Phase checklist in `ACTIVE-PLAN.md`
4. This file stays as the master backlog for strategic ideas across all phases
