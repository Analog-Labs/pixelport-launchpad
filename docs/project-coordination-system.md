# PixelPort — Project Coordination System

**Date:** 2026-03-05
**Purpose:** How all agents (Founder, Claude chat, CTO Claude Code, Codex) stay in sync across async sessions
**Source of Truth:** GitHub repo (shared by all parties)

---

## The Problem We're Solving

Multiple AI agents + one founder working async on the same project. When anyone picks up work — whether it's tomorrow morning or next week — they need to instantly know: what's done, what's in progress, what's next, and what decisions have been made. No re-explaining. No lost context.

---

## The System: 4 Files That Keep Everyone in Sync

### File 1: `CLAUDE.md` — The Constitution (Short, ~80 lines)

This is the first file every agent reads. It's NOT a novel — it's a router that tells agents where to find everything else. Think of it as a table of contents for the whole project.

**Rules:**
- Keep it under 100 lines
- Only contains: project identity, who does what, where to find things, and session protocol
- Never put detailed specs, decisions, or status here — point to other files instead
- Every agent reads this first, every session

### File 2: `docs/SESSION-LOG.md` — The Handoff Note

This is the most important file for continuity. Updated at the END of every work session by whoever did the work. When anyone starts a new session, they read this first.

**Structure:**
```
## Last Session
- **Date:** 2026-03-02
- **Who worked:** Founder + Claude (chat)
- **What was done:** [2-3 bullet points]
- **What's next:** [the immediate next task]
- **Blockers:** [anything waiting on someone else]
- **Decisions made:** [any new decisions, with brief reasoning]

## Previous Sessions (keep last 5, archive older)
...
```

**Rules:**
- Maximum 5 recent sessions visible. Older sessions get moved to `docs/archive/session-history.md`
- Every agent MUST update this before ending their session
- Be specific: "Deployed LiteLLM to Railway, health check passes" NOT "worked on infrastructure"

### File 3: `docs/ACTIVE-PLAN.md` — What We're Building Right Now

This is the current sprint/phase checklist. Right now it's Phase 0. When Phase 0 is done, this file gets updated to Phase 1.

**Structure:**
```
## Current Phase: Phase 0 — Foundation
**Target:** Week of March 3-14, 2026

### Founder Track (Lovable)
- [x] Lovable project created
- [x] GitHub repo connected
- [x] Vercel connected
- [ ] Landing page ← ACTIVE
- [x] Supabase Auth setup (Google OAuth + email/password)
- [ ] Dashboard shell

### CTO Track (Backend)
- [ ] LiteLLM on Railway ← ACTIVE (Codex Slice 1)
- [ ] Supabase migrations (Codex Slice 2)
- [ ] API bridge (Codex Slice 3)
- [ ] Provisioning script (Codex Slice 4)

### Shared
- [x] Supabase credentials shared
- [ ] 0.9 dry-run gate

### Blockers
- None currently
```

**Rules:**
- Only ONE phase is "active" at a time
- Check off items as they complete
- Add blockers immediately when discovered
- When a phase completes, archive the old plan to `docs/archive/` and update with next phase

### File 4: `docs/pixelport-project-status.md` — The Full History (Already Exists)

This is the comprehensive status document we already maintain. It has the full decisions log, all Growth Swarm history, phase details, fixes, and lessons learned. It's the reference library — not the daily working doc.

**Rules:**
- Updated after meaningful milestones (phase completion, major decisions, fixes)
- NOT updated every session — that's what SESSION-LOG.md is for
- Contains the complete decisions log (all 52+ decisions)
- Contains the fixes & lessons learned table

---

## Repo Structure (What Goes Where)

```
pixelport/                          ← GitHub repo (Lovable monorepo)
│
├── CLAUDE.md                       ← Constitution (short, ~80 lines)
│
├── docs/
│   ├── SESSION-LOG.md              ← Handoff note (read first, update last)
│   ├── ACTIVE-PLAN.md              ← Current phase checklist
│   ├── pixelport-project-status.md ← Full project history + decisions
│   ├── pixelport-master-plan-v2.md ← Product spec (52 locked decisions)
│   ├── lovable-collaboration-guide.md
│   ├── openclaw-reference.md
│   ├── strategic-ideas-backlog.md
│   │
│   └── archive/                    ← Completed phases + old session logs
│       ├── phase0/                 ← 5 completed Phase 0 slice docs
│       ├── phase1/                 ← 8 completed Phase 1 slice docs
│       ├── session-history.md
│       ├── cto-instructions-master-plan-v2-transition.md
│       ├── CODEX-QA-BRIEF.md
│       └── codex-wi4-sync-docs-templates.md
│
├── src/                            ← Lovable frontend (auto-generated)
├── api/                            ← CTO backend code
├── infra/                          ← Infrastructure configs
└── supabase/                       ← Database migrations
```

---

## Session Protocol (For Every Agent)

### When Starting a Session

```
1. Read CLAUDE.md (the constitution — tells you where everything is)
2. Read docs/SESSION-LOG.md (what happened last, what's next)
3. Read docs/ACTIVE-PLAN.md (the current phase checklist)
4. If you need more context → read docs/pixelport-project-status.md
5. If you need product spec → read docs/pixelport-master-plan-v2.md
6. Start working on the next task from ACTIVE-PLAN.md
```

### When Ending a Session

```
1. Update docs/ACTIVE-PLAN.md (check off completed items, note new blockers)
2. Update docs/SESSION-LOG.md (add a new "Last Session" entry, push previous down)
3. If a major decision was made → add to decisions log in pixelport-project-status.md
4. If something broke and was fixed → add to fixes table in pixelport-project-status.md
5. Commit and push to GitHub
```

### Before Making Any Changes

```
ALL agents must follow this rule:

→ If the change affects architecture, product decisions, or how other
  agents work: ASK THE FOUNDER FIRST.

→ If the change is implementation detail within your assigned scope
  (e.g., CTO choosing between two equivalent libraries): proceed,
  but LOG THE DECISION in SESSION-LOG.md.

→ If you're unsure whether it needs founder approval: ASK.
  Present options in plain language with trade-offs.
```

---

## Who Does What (Role Boundaries)

### Founder (Sanchal)
- Makes all product, architecture, and strategic decisions
- Builds frontend pages in Lovable
- Reviews and approves CTO proposals
- Maintains this Claude Project (chat) for brainstorming
- Pastes instruction files to CTO Claude Code sessions

### Claude (Chat — This Project)
- Founder's thinking partner and architect
- Generates instruction docs, reviews plans, creates CTO packages
- Designs frontend prompts for Lovable
- Maintains awareness of full project context via Project files
- Does NOT directly modify the GitHub repo (founder pastes outputs)

### CTO (Claude Code)
- Reads instruction files from `docs/phase0/` (or current phase)
- Builds backend: API routes, infrastructure, integrations
- Proposes technical decisions → waits for founder approval
- Updates SESSION-LOG.md and ACTIVE-PLAN.md after each session
- Does NOT touch Lovable-generated frontend files

### Codex
- Executes specific slice instruction files written by CTO
- Works within clearly scoped tasks (one slice = one task)
- Reports results back to CTO for verification
- Does NOT make architectural decisions

**Codex as QA/Debug Resource:**
- QA audits: code review against specs, risk identification (P1/P2 classification)
- Debugging slices: investigate errors, trace config issues, validate OpenClaw integration
- Architecture review: identify drift between docs/templates and runtime, flag inconsistencies
- Instruction pack format: Context → Scope → Tasks → Verification → Rollback

**When to use Codex for QA:**
- After completing a feature or fix — send code for audit before shipping
- When debugging complex integration issues (OpenClaw config, LiteLLM routing, SSH scripts)
- When docs/templates may be stale and need validation against runtime behavior

**When NOT to use Codex:**
- For architectural decisions (those require founder approval)
- For frontend work (that's Lovable + Claude chat)
- For real-time interactive debugging (use CTO Claude Code directly)

---

## Communication Flow

```
Founder ←→ Claude (chat)     : Brainstorm, plan, generate instructions
Founder  → CTO (paste docs)  : Hand off instruction files
CTO      → Codex (delegate)  : Send slice-specific tasks
CTO      → Codex (QA)        : Send code for audit, get P1/P2 risk report
Codex    → CTO (report)      : Results, completion status, and QA findings
CTO      → Founder (report)  : Status updates via SESSION-LOG.md
Everyone → GitHub repo        : Single source of truth
```

---

## The Golden Rules

1. **One source of truth.** If it's not in the GitHub repo, it doesn't exist. Don't rely on chat memory.

2. **Read before you write.** Every session starts by reading SESSION-LOG.md and ACTIVE-PLAN.md. No exceptions.

3. **Update before you stop.** Every session ends by updating SESSION-LOG.md and ACTIVE-PLAN.md. No exceptions.

4. **Ask before you decide.** Any decision that affects the product or other agents' work gets presented to the founder as options first.

5. **Keep CLAUDE.md short.** Under 100 lines. It's a router, not a novel.

6. **One phase at a time.** ACTIVE-PLAN.md only shows the current phase. Previous phases go to archive.

7. **Log everything that matters.** Decisions, fixes, lessons learned — they go in pixelport-project-status.md so we never repeat mistakes.

8. **Be specific in handoffs.** "Deployed LiteLLM" is useless. "Deployed LiteLLM to Railway at https://litellm-xyz.railway.app, health check returns 200, test team created, virtual key generated" is useful.

---

*This system is designed to be lightweight. Four files. Simple rules. Any agent can pick up the project at any time and know exactly where things stand.*
