# Changelog

All notable changes to PixelPort are documented here.

## [0.19.2.0] - 2026-03-23

### Added
- Dashboard Home page with approval banner, agent cards, weekly cost summary, and intelligence brief placeholder
- Agents page with live status, activity timeline, budget tracking, and Chief workspace launch
- Approval queue with inline editing, draft save, approve/reject flow, and DOMPurify XSS sanitization
- Run History page with expandable detail panels, cost coloring, and event timeline
- Tasks kanban board with drag-and-drop status updates, mobile snap-scroll, and slide-out detail panel with comments
- Tenant proxy board-handoff with agent-key fallback for resilient API routing
- Shared AgentPulseDot component with animated status indicators
- Agent display name resolver with preferred Chief name support
- Runtime launch helper for opening Chief workspaces from dashboard

### Fixed
- XSS protection via DOMPurify sanitization on approval content rendering
- Null-safe chaining in Paperclip normalizer prevents crashes on malformed API data
- Focus-visible rings on all custom interactive buttons for keyboard accessibility
- Task detail panel backdrop now visible (bg-black/50 + backdrop-blur)
- Empty state text colors aligned with DESIGN.md muted-foreground palette
- Approve CTA uses shimmer-btn pattern per DESIGN.md
- Home page heading hierarchy restored (h1 greeting added)

### Changed
- Approval mutations now use Clerk session token auth (Bearer header) instead of agent key
- Tenant proxy falls back gracefully to agent-key proxy when board handoff fails
