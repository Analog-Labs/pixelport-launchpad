

## Plan: Full 3-Step Onboarding Flow

Build a `/onboarding` route with a 3-step wizard (Company Info → Agent Personalization → Connect Tools), plus routing guards and dashboard integration.

### New Files

**`src/pages/Onboarding.tsx`** — Main onboarding page component
- Full-page layout matching login/signup style (dark bg, centered card, PixelPort logo top-left)
- Manages all state: `step` (1-3), form data object matching `OnboardingPayload` interface
- Card: `max-w-[640px]`, `bg-[#111118]`, amber border, `rounded-2xl`, `p-10`
- Step transitions: CSS opacity/transform transition on content swap
- Final "Launch My Agent" triggers loading screen (cycling text + progress dots), console.logs payload, sets localStorage keys (`pixelport_onboarded`, `pixelport_agent_name`, `pixelport_agent_avatar`, `pixelport_agent_tone`), waits 4s, navigates to `/dashboard`

**`src/components/onboarding/StepIndicator.tsx`** — Reusable progress indicator
- Three numbered circles connected by lines
- States: completed (amber + checkmark), current (amber + number), future (outline #333 + gray number)
- Step labels below: "Company Info" / "Your Agent" / "Connect Tools"

**`src/components/onboarding/StepCompanyInfo.tsx`** — Step 1
- Company Name input (required, min 2 chars)
- Website URL input (optional, with helper text and conditional amber tag)
- Marketing Goals as toggle pills in 2-col grid (8 options with emojis + "Other" with conditional text input)
- "Next →" button disabled until name filled + 1 goal selected

**`src/components/onboarding/StepAgentSetup.tsx`** — Step 2
- Agent Name input (default "Luna")
- Tone selector: 3 radio-style cards (Casual/Professional/Bold), default Professional
- Avatar picker: 6 circular options with colored gradients/emojis, amber ring on selected
- Live preview card showing selected avatar + name + tone-appropriate sample message
- Back + Next buttons

**`src/components/onboarding/StepConnectTools.tsx`** — Step 3
- Slack connection card with logo, description, "Connect Slack" button → toast "coming soon" then disabled state
- "What happens next" info box with dashed amber border and 4 checklist items
- Back + "Launch My Agent" button (rocket emoji)

### Modified Files

**`src/App.tsx`**
- Add `/onboarding` route (outside dashboard layout, inside AuthProvider)
- Import new `Onboarding` page

**`src/pages/Signup.tsx`**
- After successful signup, the existing flow shows a "check your email" screen — no change needed there. But after email verification and login, user hits ProtectedRoute which will redirect to onboarding.

**`src/components/ProtectedRoute.tsx`**
- After confirming user is authenticated, check `localStorage.getItem('pixelport_onboarded')`. If not set, redirect to `/onboarding` instead of rendering dashboard children.

**`src/pages/dashboard/Home.tsx`**
- Read `pixelport_agent_name` and `pixelport_agent_avatar` from localStorage
- Update Chief of Staff card to show the chosen agent name and matching avatar instead of hardcoded "L" and "Luna"

### Routing Logic Summary

```text
Signup complete → email verification → login → ProtectedRoute
  → if no pixelport_onboarded → redirect /onboarding
  → if onboarded → render dashboard

/onboarding page:
  → if not authenticated → redirect /login
  → if pixelport_onboarded exists → redirect /dashboard
  → otherwise → show wizard
```

### Design Details

- All colors: `#0A0A0F` bg, `#111118` card, amber `#D4A853` accents, `rgba(212,168,83,0.15)` borders
- Goal pills: selected = `bg-[#D4A853]/20 border-[#D4A853] text-white`, unselected = `bg-[#1A1A24] border-[#333] text-gray-400`
- Tone cards: selected = `bg-[#111118] border-[#D4A853] border-2 shadow-[0_0_12px_rgba(212,168,83,0.1)]`, unselected = `bg-[#1A1A24] border-[#333]`
- Avatar circles: 48px, selected gets 3px amber ring + `scale-110` transform
- Loading screen: PixelPort logo centered, amber pulsing animation, text cycles every 2s with fade, 4 progress dots filling sequentially
- Mobile: tone cards stack vertically, goal pills single column, card padding reduces

