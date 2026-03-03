

## PixelPort Landing Page — Complete Rebuild Plan

This is a full landing page rebuild: switching from the current light/glass theme to a dark, premium SaaS design with amber/gold accents. The page will have 8 content sections plus navbar and footer, all with scroll animations and interactive elements.

### Architecture

Single-page app with anchor navigation. No backend needed. All sections in `Index.tsx` using extracted components.

### Files to Create/Modify

**New files:**
- `src/components/landing/Navbar.tsx` — sticky nav with scroll-aware opacity, hamburger on mobile
- `src/components/landing/HeroSection.tsx` — two-column hero with animated product preview (Slack mock ↔ Dashboard mock crossfade)
- `src/components/landing/TrustBar.tsx` — horizontal trust signals strip
- `src/components/landing/FeaturesSection.tsx` — 3x3 grid of feature cards with hover glow
- `src/components/landing/HowItWorksSection.tsx` — 3 numbered steps with connector line
- `src/components/landing/PricingSection.tsx` — 3 pricing cards, Pro highlighted
- `src/components/landing/SecuritySection.tsx` — 4 infrastructure cards
- `src/components/landing/IntegrationsSection.tsx` — logo grid, grayscale→color on hover
- `src/components/landing/FAQSection.tsx` — accordion with 8 Q&As
- `src/components/landing/CTASection.tsx` — final call-to-action with amber glow
- `src/components/landing/Footer.tsx` — 5-column footer
- `src/components/landing/SlackMock.tsx` — animated Slack conversation UI
- `src/components/landing/DashboardMock.tsx` — animated dashboard card UI
- `src/components/landing/ProductPreview.tsx` — crossfade wrapper cycling between mocks
- `src/hooks/useScrollAnimation.ts` — intersection observer hook for fade-in on scroll

**Modified files:**
- `src/index.css` — complete theme overhaul: dark background (#0A0A0F), amber accents (#D4A853), new CSS variables, grain texture
- `tailwind.config.ts` — add amber/gold colors, fade-in/slide-up animations, new keyframes
- `src/pages/Index.tsx` — compose all landing sections
- `src/components/PixelPortLogo.tsx` — update to dark theme with amber dot accent
- `index.html` — update title to "PixelPort — Your AI Chief of Staff", meta tags

### Design System Changes

| Token | Current | New |
|-------|---------|-----|
| `--background` | `48 33% 97%` (warm white) | `240 33% 3%` (#0A0A0F) |
| `--foreground` | `228 25% 15%` (dark) | `0 0% 96%` (#F5F5F5) |
| `--card` | `0 0% 100%` | `240 14% 10%` (#14141A) |
| `--primary` | `230 75% 50%` (blue) | `38 60% 58%` (warm amber #D4A853) |
| `--border` | `228 20% 90%` | `240 14% 14%` (#1E1E28) |
| `--muted-foreground` | `228 10% 45%` | `220 9% 64%` (#9CA3AF) |

Typography: Import Satoshi (or Cabinet Grotesk) via Google Fonts or CDN. Monospace for agent messages via `font-mono`.

### Interactive Features

1. **Product preview crossfade**: `useState` + `useEffect` with 5s interval toggling between `SlackMock` and `DashboardMock`, CSS opacity transition
2. **Scroll animations**: Custom hook using `IntersectionObserver`, applies `animate-fade-in` class when elements enter viewport
3. **Feature card hover**: Tailwind `hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(212,168,83,0.1)]`
4. **Integration logos**: `grayscale filter-grayscale hover:filter-none` transition
5. **FAQ accordion**: Using existing shadcn `Accordion` component with amber styling
6. **Navbar scroll**: `useEffect` tracking `scrollY` to toggle backdrop opacity class
7. **Background grain**: CSS `::before` pseudo-element with noise SVG data URI

### Section Details

Each section uses the content exactly as specified in the prompt (feature cards, pricing tiers $299/$999/$3000+, FAQ answers, security items, etc.). All CTA buttons link to `"#"` for now. "Book a Demo" also links to `"#"`.

### Responsive Strategy

- **Desktop**: Full layouts as described (3-column grids, two-column hero)
- **Tablet** (`md`): 2-column grids, hero stacks vertically
- **Mobile** (`sm`): Single column, hamburger nav via sheet/drawer component, stacked pricing cards

