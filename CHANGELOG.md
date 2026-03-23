# Changelog

All notable changes to PixelPort are documented here.

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
