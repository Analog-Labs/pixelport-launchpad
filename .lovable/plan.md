

## Plan: Rearrange Hero Layout + Add Agent Dashboard Panel

Restructure the landing page hero area to match the SecondShift screenshot layout: centered headline/copy/CTAs on top, a large interactive "agent team room" dashboard panel below, proof chips underneath, then an integrations strip -- all keeping PixelPort's dark/amber color scheme and existing text.

### Layout Change (HeroSection.tsx)

Current: side-by-side grid (55% text left, 45% product preview right).
New: fully centered, stacked vertically:
1. Badge ("Built on OpenClaw...")
2. Centered h1 ("Your AI Chief of Staff")
3. Centered subtitle paragraph
4. Two CTA buttons centered (amber "Start Free 14 Day Trial" + outlined "Book a Demo")
5. "No credit card required" text centered
6. Large `AgentTeamRoom` component below (replaces the small SlackMock/DashboardMock toggler)
7. Proof chips row (4 items with icons: "24/7 execution", "Multi-agent collaboration", "Approval gates", "Full audit trail")
8. Integrations strip with a separator line, "Connects to the tools you already use" text, and inline SVG brand logos (Slack, LinkedIn, X/Twitter, OpenAI, Gemini, Notion, HubSpot, PostHog)

### New File: `src/components/landing/AgentTeamRoom.tsx`

A PixelPort-themed version of the SecondShift TeamRoom, adapted to dark/amber styling. Static data (no external data file needed). Structure:

- **Window chrome header**: three dots (red/amber/green), "Marketing Team" title, green "Live" indicator -- styled with `bg-card border-border` (dark theme)
- **Two-column body** (stacks on mobile):
  - **Left: Agent Roster** -- Manager Agent (Luna, with amber crown icon) + 5 sub-agents (Research, Copywriter, Designer, Publisher, Analyst) each with icon, description, and colored status badge. Status badges use dark-theme-compatible colors (e.g., `bg-emerald-500/15 text-emerald-400`)
  - **Right: Live Work Feed** -- 4 feed items with green dot, description text, timestamp, and agent tag pill
- **Footer**: workflow step pills (Plan, Create, Review, Publish, Measure, Improve) + "Run a cycle" button. The "Run a cycle" button animates through the steps, briefly highlighting each pill in sequence -- same behavior as SecondShift's TeamRoom

### Files to Modify

- **`src/components/landing/HeroSection.tsx`** -- Replace grid layout with centered stacked layout. Remove `ProductPreview` import, add `AgentTeamRoom` import. Add proof chips and integrations strip below the dashboard panel.
- **`src/pages/Index.tsx`** -- Remove `TrustBar` from the page (its content is now absorbed into the hero section's proof chips and integrations strip).

### Files to Delete

- **`src/components/landing/ProductPreview.tsx`** -- No longer used (replaced by AgentTeamRoom)
- **`src/components/landing/SlackMock.tsx`** -- No longer used
- **`src/components/landing/DashboardMock.tsx`** -- No longer used
- **`src/components/landing/TrustBar.tsx`** -- Content moved into HeroSection

### Design Adaptation

All SecondShift styles (light bg, colored text badges) will be converted to PixelPort's dark theme:
- Card: `bg-card border-border` (the existing dark card style)
- Status badges: dark-tinted backgrounds with lighter text (e.g., `bg-emerald-500/10 text-emerald-400` instead of `bg-emerald-50 text-emerald-600`)
- Feed items: `bg-surface` background
- Window dots and "Live" indicator stay the same
- Workflow pills: default `bg-secondary text-muted-foreground`, active `bg-primary text-primary-foreground`
- Integration logos: use Lucide icons matching the existing IntegrationsSection (MessageSquare for Slack, Linkedin, Twitter, Brain for OpenAI, Sparkles for Gemini, etc.) styled as small 28px icons in a horizontal row

### Section Height

The hero section changes from fixed `h-[90vh]` to `min-h-screen` with auto height, since the centered layout + large dashboard panel will naturally be taller than the viewport.

