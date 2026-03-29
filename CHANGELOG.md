# Changelog

All notable changes to PixelPort are documented here.

## [0.19.6.0] - 2026-03-28

### Added
- Two-panel onboarding layout with live agent preview panel (desktop) and compact mobile bar
- Six SVG avatar illustrations (Command, Operator, Orbit, Vector, Grid, Signal) with glow effects replacing monogram circles
- Staggered entry animations (avatar-appear, section-slide-in, ambient-pulse) with prefers-reduced-motion support
- Step 4 "awakening ceremony" with centered large avatar, config summary, and activate button
- Clickable step indicator for navigating back to completed steps (locked during provisioning)
- Tone preview phrases shown in agent preview panel

### Changed
- Onboarding steps 1-3 use flat sections instead of bordered cards with staggered animations
- Strategy step has bigger header, collapsible products section, and inline custom goal toggle
- Task setup step uses divider-based approval section instead of bordered cards
- Launch step splits into pre-launch (activate button) and post-launch (progress) views
- Avatar picker uses horizontal strip of SVG illustrations instead of monogram circles
- Tone selector uses rounded pill chips instead of bordered cards
- Vite dev server now proxies /api to production for local frontend development

### Fixed
- Step navigation is now locked during provisioning to prevent config drift
- Sign-out button handles errors gracefully (always navigates to login)
- Removed dead props from MobileAgentBar and StepConnectTools interfaces

## [0.19.5.0] - 2026-03-28

### Added
- Session 8 approval-policy runtime apply worker now processes `pixelport/policy.apply.requested` events with stale-revision skip guards and persisted apply outcomes
- Connections now includes a Governance card where operators can edit approval mode/guardrails, save policy changes, and trigger retry apply when runtime patching fails
- Tenant status contract now surfaces `policy_apply` runtime truth for governance UI state rendering

### Changed
- New tenant workspace scaffolding now seeds managed approval-policy marker blocks in both `AGENTS.md` and `TOOLS.md`
- Onboarding save now performs synchronous policy apply attempts, writes audit/runtime state to `onboarding_data`, and queues worker fallback on runtime patch failures
- Session 8 tests now cover revision conflicts, sync apply success/failure paths, worker fail-closed marker behavior, and governance UI save/retry flows

### Fixed
- Legacy tenants without an `approval_policy_runtime` block now return `policy_apply: null` (instead of misleading default pending state) from `/api/tenants/status`

## [0.19.4.0] - 2026-03-27

### Added
- Knowledge dashboard is now live at `/dashboard/knowledge` with five collapsible sections, markdown read mode, and section-level edit controls
- Session 7 save flow now protects against stale overwrites with revision-aware conflict responses (`409 knowledge_conflict`)
- Manual Knowledge sync retry is now available from the same onboarding contract using `force_knowledge_sync`

### Changed
- Startup routing for fresh tenants now runs through the Session 5 Paperclip kickoff/wakeup path while keeping manual bootstrap replay as break-glass recovery
- Knowledge mirror sync status (`pending` / `synced` / `failed`) from Session 6 is now surfaced and exercised end-to-end through the Session 7 dashboard UI
- Release documentation now reflects Sessions 1-7 production closure and board11 live canary evidence

### Fixed
- Session 7 canary sync stall was resolved operationally by re-registering Inngest functions and triggering explicit retry, resulting in terminal `synced` status on live tenant `board11`

## [0.19.3.0] - 2026-03-26

### Added
- Session 4 workspace compiler now scaffolds canonical OpenClaw root files for new tenants: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOT.md`, and `MEMORY.md`
- Provisioned workspaces now include deterministic `/system` outputs (`onboarding.json`, `render-manifest.json`), minimal `/knowledge` scaffolds, and `skills/paperclip/SKILL.md`
- Added a strict config-validation smoke-test assertion for OpenClaw startup (`openclaw.mjs config validate --json`) in provisioning cloud-init tests

### Changed
- OpenClaw tenant config emission now sets `agents.defaults.skipBootstrap: true`, narrows heartbeat to `every: "0m"`, and includes memory search `extraPaths: ["knowledge"]`
- Project docs now include Session 4 production canary evidence (`board4`) and refreshed Sessions 1-4 program state

## [0.19.2.0] - 2026-03-23

### Added
- **Dashboard Home** — see pending approvals, agent status, weekly cost, and intelligence brief at a glance
- **Agents page** — live agent status with pulse indicators, activity timeline, budget tracking, and one-click Chief workspace launch
- **Approval queue** — review, edit inline, save drafts, approve or reject your Chief's work before it goes live
- **Run History** — expandable run details with cost coloring, duration, and event timeline
- **Tasks board** — drag-and-drop kanban with mobile snap-scroll, slide-out detail panels, and inline comments
- Resilient API routing — tenant proxy now falls back to agent-key auth if board handoff fails

### Fixed
- Approval content is now sanitized (DOMPurify) to prevent XSS from agent-generated HTML
- All custom buttons now have visible focus rings for keyboard navigation
- Task detail panel has a proper backdrop overlay so you can tell a panel is open
- Empty states use consistent text colors per the design system
- Approve button now uses the signature shimmer animation

### Changed
- Approval actions now authenticate with your session token instead of the agent key — more secure and consistent with other dashboard requests
