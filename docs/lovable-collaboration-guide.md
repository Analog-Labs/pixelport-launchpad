# How We Work Together on the Lovable Frontend

**For:** Sanchal (Founder) + Claude (claude.ai)
**Context:** Building PixelPort's dashboard and web app in Lovable Cloud

---

## The Problem You Described

Long chats lose context. Complex tasks trigger compression that sometimes hangs. You need a way to work asynchronously on frontend without losing progress.

## Recommended Approach: Page-Per-Chat + Shared Context Doc

### Rule 1: One Lovable Page = One Claude Chat

Don't try to build everything in one conversation. Instead:

| Chat | Scope |
|------|-------|
| Chat 1 | Landing page (pixelport.ai) |
| Chat 2 | Auth flow (signup → workspace → redirect) |
| Chat 3 | Onboarding (3-step chat widget) |
| Chat 4 | Dashboard Home page |
| Chat 5 | Content Pipeline page |
| Chat 6 | Content Calendar page |
| Chat 7 | Performance page |
| Chat 8 | Knowledge Vault page |
| Chat 9 | Settings pages |
| Chat 10 | Agent Chat widget + full-page |

Each chat stays focused. No compression needed. When done, the output lives in Lovable — not in the chat history.

### Rule 2: Use a Shared Context Doc (Your Bridge)

Create a Google Doc or Notion page called **"PixelPort Frontend Status"** that you paste at the start of each new chat. It contains:

```
## PixelPort Frontend — Current State

### Completed Pages
- [x] Landing page — live at pixelport.ai
- [x] Auth flow — Supabase Auth integrated (Google OAuth + email/password), redirects to dashboard

### In Progress
- [ ] Dashboard Home — layout done, agent status card WIP

### Design Decisions (Locked)
- Color palette: [whatever you pick]
- Font: Inter
- Component library: shadcn/ui via Lovable
- Dark mode: yes/no

### Supabase Schema (Shared with CTO)
- tenants: id, name, slug, created_at, plan
- agents: id, tenant_id, name, avatar_url, tone, status
- content_items: id, tenant_id, platform, status, body, created_at
- [evolves as we build]

### API Contracts (From CTO)
- GET /api/tenants/:id/agents
- GET /api/tenants/:id/content?status=pending
- [CTO provides these, you paste here]

### Next Page to Build
Dashboard Home — see master plan Section 9.2 for spec
```

At the start of each new chat, paste this doc + the relevant section of the master plan for that page.

### Rule 3: Keep Master Plan in This Project

The master plan (v2.0) stays in this Claude Project. When you start a new chat in this project, I already have access to it. You just need to say: *"I'm building the [X] page in Lovable. Here's where we left off: [paste status doc]."*

### Rule 4: Lovable Does the Building, Claude Does the Thinking

The actual code generation happens in Lovable's AI. Your workflow:

1. **In Claude (this project)**: Discuss what the page should do, review the master plan spec, make design decisions, write the prompt for Lovable
2. **In Lovable**: Paste the prompt, iterate on the visual output, deploy
3. **Back in Claude**: Review what Lovable built, plan the next page, coordinate with CTO on API contracts

You're using Claude as the **architect** and Lovable as the **builder**.

### Rule 5: Screenshots Are Your Best Friend

When you want me to review what Lovable built:
- Take a screenshot and upload it to the chat
- I can see the visual and suggest changes
- Much faster than describing what's on screen

---

## How CTO/Codex Access Lovable's Output

Lovable Cloud handles this automatically:

1. **GitHub**: Lovable auto-pushes every change to a GitHub repo. CTO clones the same repo.
2. **Supabase**: Lovable Cloud provisions the Supabase instance. Share the connection string / project URL with CTO. Both write to the same DB.
3. **Vercel**: Connect the GitHub repo to Vercel. Frontend deploys automatically. CTO adds API routes (in `api/` directory) to the same repo — they deploy together.

**Setup steps (do once):**
- [ ] Create Lovable Cloud project for PixelPort
- [ ] Connect to GitHub (Lovable does this automatically)
- [ ] Share GitHub repo access with CTO/Codex
- [ ] Share Supabase project URL + service role key with CTO
- [ ] Connect GitHub repo to Vercel
- [ ] CTO adds `api/` directory for backend endpoints

---

## Dealing with Context Loss

If a chat does get long and starts compressing:

1. **Don't fight it.** End the chat gracefully.
2. **Update your status doc** with what was accomplished.
3. **Start a new chat** with the updated status doc pasted in.
4. I'll pick up exactly where you left off — this project's files give me the full picture.

The key insight: **your progress lives in Lovable and your status doc, not in the chat.** The chat is disposable. The outputs aren't.

---

## Suggested First Session

Start with the landing page. It's self-contained, doesn't need API integration, and gives you a feel for the Lovable workflow. Here's how:

1. Open a new chat in this project
2. Say: "Let's design the PixelPort landing page. Positioning: 'Your AI Chief of Staff.' Pricing: $299/$999/$3K+. 14-day free trial. Need: hero, features, pricing table, CTA."
3. We'll iterate on the design together
4. You take the result to Lovable and build it
5. Screenshot → review → next page

---

## Summary

| Principle | Practice |
|-----------|----------|
| Don't build everything in one chat | One page per chat |
| Don't rely on chat memory | Maintain a status doc you paste in |
| Don't code in Claude | Design in Claude, build in Lovable |
| Don't lose context when chat compresses | Progress lives in Lovable + status doc, not chat |
| Don't silo from CTO | Shared GitHub + Supabase + Vercel |
