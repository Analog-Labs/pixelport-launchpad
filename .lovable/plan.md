

## Plan: Post-Action Guidance Flows on Connections Page

Single file change: `src/pages/dashboard/Connections.tsx`

### Changes

**1. Setup Progress Banner** (lines 96-97, insert between header and Slack card)
- Conditional banner shown when either Slack or Email is not connected
- Uses existing `Loader2` icon with amber styling
- Card styled: `border border-zinc-800 bg-zinc-900 rounded-lg p-4`

**2. Slack Post-Connection Guidance** (lines 114-128, restructure Slack card)
- Change `CardContent` layout from single flex row to a column layout when connected (flex row for icon+status+button stays, guidance section appended below)
- When `slack.connected === true`, render a guidance section after the status row:
  - Divider: `border-t border-zinc-800 mt-4 pt-4`
  - "What happens next?" heading
  - 3 bullet items (agent active, DM/mention, content drafts)
  - "Open Slack" outline button linking to `https://app.slack.com`

### Files changed
Only `src/pages/dashboard/Connections.tsx` — purely additive, no logic changes.

