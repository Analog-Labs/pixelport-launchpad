# Design System — PixelPort

## Product Context
- **What this is:** AI Chief of Staff SaaS — autonomous marketing engine that gets smarter every week
- **Who it's for:** Marketing leads and founders at 5-20 person B2B companies
- **Space/industry:** AI agent platforms, marketing automation, SaaS dashboards
- **Project type:** Web app (dashboard) + marketing landing page

## Aesthetic Direction
- **Direction:** Industrial-Luxe — the precision of Linear meets the warmth of a premium brand
- **Decoration level:** Intentional — grain texture at 3% opacity (signature), ambient amber radial gradients for depth
- **Mood:** Command center run by someone with good taste. Professional, warm, confident. Never cold or clinical.
- **Reference sites:** Linear (precision), Raycast (dark premium), Vercel (clean structure)
- **Anti-patterns:** No purple/violet gradients, no 3-column icon-in-circle grids, no centered-everything layouts, no gradient buttons (use shimmer instead)

## Typography

### Font Family: Satoshi (single family, weight-based hierarchy)
- **CDN:** `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,900&display=swap`
- **Feature settings:** `font-feature-settings: "cv02", "cv03", "cv04", "cv11"`
- **Fallback stack:** `'Satoshi', system-ui, -apple-system, sans-serif`

### Weights & Roles
| Weight | Role | Example |
|--------|------|---------|
| 900 (Black) | Hero headlines, page titles | "Your AI Chief of Staff" |
| 800 (ExtraBold) | Section headings, card stat values | "Everything a Chief does" |
| 700 (Bold) | Card titles, feature names, emphasis | "Competitor Intelligence" |
| 600 (SemiBold) | Button labels, badges, nav active | "Start Free" |
| 500 (Medium) | Body text, descriptions, nav items | Body paragraphs |
| 400 (Regular) | Secondary text, metadata | Subtle descriptions |

### Data Font: Geist Mono
- **CDN:** `https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.min.css`
- **Usage:** Metrics, timestamps, tabular data, section labels, status codes, agent metadata
- **Size:** Typically 11-13px for data, 10-11px for section labels
- **Style:** Uppercase + letter-spacing for section labels (`letter-spacing: 0.08-0.1em; text-transform: uppercase`)

### Type Scale
| Size | Weight | Usage |
|------|--------|-------|
| 56px | 900 | Hero headline (landing page) |
| 48px | 900 | Page title (in-app) |
| 32px | 800 | Section title |
| 22px | 800 | Subsection / dashboard greeting |
| 16px | 700 | Card title, feature name |
| 15px | 500 | Default body |
| 14px | 500 | Compact body, descriptions |
| 13px | 500 | Navigation, labels |
| 12px | Mono | Section labels, metadata |
| 11px | Mono | Timestamps, fine data |
| 10px | Mono | Integration labels |

## Color

### Approach: Restrained
Amber is the ONLY accent color. Everything else is grayscale. When something glows amber, it matters.

### Palette (HSL CSS Variables)
```css
:root {
  /* Surfaces */
  --background: 240 6% 4%;       /* #0A0A0B — page background */
  --card: 240 6% 10%;             /* #18181B — elevated surface */
  --surface: 240 6% 10%;          /* #18181B — alias for card */
  --popover: 240 6% 10%;

  /* Text */
  --foreground: 240 5% 96%;       /* #F5F5F4 — primary text */
  --muted-foreground: 240 5% 65%; /* #A1A1AA — secondary text */
  /* Tertiary: #71717A (use inline where needed) */

  /* Primary (Amber) */
  --primary: 38 60% 58%;          /* hsl(38, 60%, 58%) — amber/gold */
  --primary-foreground: 240 6% 4%; /* dark text on amber */
  --amber-glow: 38 60% 58%;       /* alias for glow effects */

  /* Borders */
  --border: 240 4% 16%;           /* #27272A — default border */
  --input: 240 4% 16%;
  --ring: 38 60% 58%;             /* focus ring = amber */

  /* Secondary / Muted / Accent */
  --secondary: 240 4% 16%;
  --secondary-foreground: 240 5% 96%;
  --muted: 240 4% 16%;
  --accent: 240 4% 16%;
  --accent-foreground: 240 5% 96%;

  /* Destructive */
  --destructive: 0 84% 60%;       /* #EF4444 */
  --destructive-foreground: 0 0% 100%;

  /* Sidebar */
  --sidebar-background: 240 6% 6%;
  --sidebar-foreground: 240 5% 96%;
  --sidebar-primary: 38 60% 58%;
  --sidebar-primary-foreground: 240 6% 4%;
  --sidebar-accent: 240 4% 16%;
  --sidebar-border: 240 4% 16%;

  --radius: 0.75rem;
}
```

### Semantic Colors
| Purpose | Hex | Usage |
|---------|-----|-------|
| Success | #22C55E | Published, online, positive metrics |
| Warning | #EAB308 | Expiring tokens, attention needed |
| Error | #EF4444 | Failed, rejected, negative metrics |
| Info | #3B82F6 | Pending, processing, informational |

### Color Usage Rules
- **Amber glow hover:** `box-shadow: 0 0 20px rgba(212, 168, 83, 0.08)` on card hover
- **Amber border hover:** `border-color: rgba(212, 168, 83, 0.4)` on interactive elements
- **Amber ambient:** `radial-gradient(circle, hsla(38, 60%, 58%, 0.06-0.08) 0%, transparent 60%)` behind hero sections
- **Amber dividers:** `linear-gradient(90deg, transparent, rgba(primary, 0.3), transparent)` between sections
- **Amber dimmed background:** `rgba(212, 168, 83, 0.05-0.12)` for badges, active sidebar items
- **Focus ring:** `box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.1)` on input focus

### Dark Mode (default)
Dark mode is the primary theme. Light mode is available via toggle.
- **Light mode surfaces:** swap to warm whites (#FAFAF9, #FFFFFF, #F5F5F4)
- **Light mode amber:** reduce saturation slightly: `hsl(38, 55%, 48%)`
- **Light mode text:** #0A0A0B primary, #57534E secondary

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — not as tight as Linear (power users), not as loose as Dust (friendly)
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Content padding:** 24px (dashboard cards), 28px (pricing cards), 32px (page container)
- **Card gap:** 12-16px between sibling cards
- **Section gap:** 64px between major sections

## Layout
- **Approach:** Grid-disciplined — strict alignment, no creative/editorial layout
- **Grid:** 12-column for main content, sidebar is fixed-width (200-220px)
- **Max content width:** 1400px (container), 1200px (content area)
- **Border radius:** `--radius: 0.75rem` (12px). Buttons and cards use this. Badges/pills use 9999px.
- **Border radius scale:** sm: calc(var(--radius) - 4px) = 8px, md: calc(var(--radius) - 2px) = 10px, lg: var(--radius) = 12px, full: 9999px

## Motion
- **Approach:** Minimal-functional with scroll animations
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(150ms) short(200ms) medium(300ms) long(600ms)
- **Hover transitions:** `transition: all 0.2s ease` (borders, shadows, colors)
- **Scroll fade-in:** `translateY(20px) → translateY(0)` with `opacity: 0 → 1`, 600ms ease-out
- **Staggered cards:** 100ms delay between siblings on scroll reveal
- **Shimmer button:** Infinite 3s shimmer highlight sweep (see shimmer-btn pattern)
- **Agent pulse:** Subtle green glow pulse on online agent dots
- **NO:** bouncy animations, spring physics, scroll-driven parallax, page slide transitions

## Signature Patterns

### Grain Texture
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,..."); /* fractalNoise SVG */
}
```

### Shimmer Button
Primary CTA pattern — amber background with animated highlight sweep:
```css
.shimmer-btn::after {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
  animation: shimmer 3s ease-in-out infinite;
}
```

### Amber Ambient Glow
Behind hero sections and featured cards:
```css
background: radial-gradient(circle, hsla(38, 60%, 58%, 0.06-0.08) 0%, transparent 60%);
```

### Section Divider
Between major content sections:
```css
background: linear-gradient(90deg, transparent, rgba(primary, 0.3), transparent);
```

## Component Library
- **Framework:** shadcn/ui (Radix primitives + Tailwind)
- **Icons:** Lucide React
- **All components use CSS variables** defined above
- **Tailwind config:** extends with font-family, colors, animations as defined in this system

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-21 | Initial design system created | Formalized from existing deployed landing page and codebase |
| 2026-03-21 | Satoshi only (no second display font) | Site already uses weight-based hierarchy effectively — one font, many weights |
| 2026-03-21 | Geist Mono for data | Clean tabular-nums, modern, pairs well with Satoshi |
| 2026-03-21 | Amber as only accent | Differentiates from blue/purple AI products — warm, premium, confident |
| 2026-03-21 | Grain texture as signature | Adds analog warmth — unique in AI agent space |
| 2026-03-21 | Dark mode primary | Category baseline for serious AI tools — signals "power tool" |
