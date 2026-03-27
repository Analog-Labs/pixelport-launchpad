# Changelog

All notable changes to PixelPort are documented here.

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
