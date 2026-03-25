# ClarixBI — Performance & Accessibility Audit

Date: 2026-03-25
Stage: S07 — QA & Testing

## Bundle Analysis

| Metric                 | Value                                      |
| ---------------------- | ------------------------------------------ |
| Total JS (chunks)      | 2.8 MB (compressed, all chunks incl. lazy) |
| First Load JS (shared) | 87.8 KB                                    |
| Framework chunk        | 137 KB                                     |
| Polyfills              | 110 KB                                     |

### Largest Chunks

| Chunk                    | Size   | Type            | Lazy Loaded          |
| ------------------------ | ------ | --------------- | -------------------- |
| 8715 (recharts)          | 763 KB | Charts library  | Yes (dynamic import) |
| 5105 (react-grid-layout) | 348 KB | Grid layout     | Yes (dynamic import) |
| cd24890f                 | 177 KB | Vendor          | Shared               |
| 1dd3208c                 | 169 KB | Vendor          | Shared               |
| framework                | 137 KB | React framework | No (required)        |
| main                     | 114 KB | Next.js runtime | No (required)        |

### Page-Specific First Load Sizes

| Page            | First Load JS        | Status     |
| --------------- | -------------------- | ---------- |
| Login           | 107 KB               | Good       |
| Home / Overview | ~110 KB              | Good       |
| Dashboards list | 119 KB               | Good       |
| Dashboard view  | 119 KB + lazy charts | Good       |
| Dashboard edit  | 137 KB + lazy grid   | Good       |
| Alerts          | 128 KB               | Good       |
| Reports         | 132 KB               | Good       |
| Data Sources    | 145 KB               | Acceptable |
| AI Chat         | 113 KB + lazy        | Good       |
| Settings        | 122 KB               | Good       |

## Core Web Vitals (Targets)

| Metric    | Target  | Notes                                               |
| --------- | ------- | --------------------------------------------------- |
| LCP       | < 2.5s  | First Load JS is 87.8KB shared — well within budget |
| FID / INP | < 100ms | No heavy JS on initial load (charts lazy-loaded)    |
| CLS       | < 0.1   | Layout stable — fonts preloaded via next/font       |

## Lighthouse Configuration

Lighthouse CI configured in `lighthouserc.js` with assertions:

- Performance: >= 90 (warn)
- Accessibility: >= 95 (error)
- Best Practices: >= 90 (warn)
- SEO: >= 90 (warn)
- LCP: < 2.5s (warn)
- CLS: < 0.1 (warn)

To run: `npx lhci collect && npx lhci assert`

## Accessibility Audit

### Automated (axe-core via Playwright)

E2E tests created in `e2e/accessibility.e2e.ts`:

- Login page: WCAG 2.1 AA scan (critical + serious violations = 0)
- All authenticated pages (7 pages): WCAG 2.1 AA scan
- Color contrast verification (WCAG AA 4.5:1)
- Form label associations
- Image alt text
- Landmark regions (main, nav)

### Keyboard Navigation

E2E tests created in `e2e/keyboard-navigation.e2e.ts`:

- Skip-to-content link: visible on Tab, navigates to #main-content
- Tab order: navbar items reachable via keyboard
- Login form: fully keyboard-navigable (checkbox, email input)
- Focus indicators: all interactive elements have visible focus styles
- Escape key: no errors when pressed without open modals

### Features Already Implemented (S06 + CR sprints)

- [x] Skip-to-content link in app layout
- [x] Focus traps on all modals (FocusTrapDialog component)
- [x] aria-live regions for dynamic content
- [x] aria-describedby on form error messages
- [x] aria-label on icon-only buttons
- [x] role="dialog" + aria-modal="true" on all modals
- [x] htmlFor + id pairs on all labels
- [x] autoComplete attributes on identity fields
- [x] Minimum text-gray-500 for WCAG AA contrast
- [x] Semantic HTML landmarks (main, nav, header, footer)
- [x] Loading states with aria-live="polite"
- [x] Error states with role="alert" aria-live="assertive"

## Performance Optimizations Already Applied

- [x] Dynamic imports for recharts, react-grid-layout, AiChat (CR04)
- [x] next/font for Inter + JetBrains Mono (no FOUT)
- [x] next/image for optimized images
- [x] Loading.tsx in all route groups for streaming (CR08)
- [x] Response caching on GET API endpoints (CR07)
- [x] Connection pooling configured (max: 30, min: 5) (CR07)
- [x] N+1 queries resolved with eager loading + batch queries (CR07)

## Recommendations

### Priority 1 (Performance)

1. **Consider tree-shaking recharts** — import specific chart types instead of full library
2. **Add `next/script` strategy="lazyOnload"** for PostHog analytics script
3. **Enable ISR** for legal pages (terms, privacy, cookies) — currently dynamic

### Priority 2 (Accessibility)

1. **Add aria-current="page"** to active nav link for screen readers
2. **Announce route changes** — add aria-live region for SPA navigation
3. **Test with screen readers** — VoiceOver (macOS), NVDA (Windows) manual testing

### Priority 3 (SEO)

1. **Add structured data** (JSON-LD) for organization info on landing page
2. **Optimize meta descriptions** per page (currently only root layout)
3. **Add canonical URLs** to prevent duplicate content across locales

## Tools & Configuration

| Tool                  | Purpose                    | Config File                      |
| --------------------- | -------------------------- | -------------------------------- |
| Lighthouse CI         | Performance + a11y scoring | `lighthouserc.js`                |
| @next/bundle-analyzer | Bundle size analysis       | `next.config.js` (ANALYZE=true)  |
| @axe-core/playwright  | Automated a11y testing     | `e2e/accessibility.e2e.ts`       |
| Playwright            | Keyboard nav testing       | `e2e/keyboard-navigation.e2e.ts` |
| check-performance.sh  | Quick audit summary        | `scripts/check-performance.sh`   |
