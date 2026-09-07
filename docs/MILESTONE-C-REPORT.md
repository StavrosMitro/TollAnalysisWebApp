# Milestone C — Verification Report

Client-facing UI/UX redesign + visual verification. **No ML methodology, external
deployment, image-size optimization, database redesign, or backend refactoring.**
UI changes are **not committed** — awaiting review.

---

## 1. Milestone B commit hashes

On branch `portfolio-demo` (4 commits, **not pushed**):

| Hash | Message |
|---|---|
| `17743b6` | `test: isolate unit and disposable database integration suites` |
| `8ec7698` | `fix(security): strengthen authentication and authorization controls` |
| `f2cb0dc` | `feat(demo): add safe read-only portfolio access` |
| `2ac57ea` | `docs: document demo authorization and verification` |

Pre-commit validation passed: `git diff --check` clean; no `.env`, build output,
`node_modules`, DB volume, runtime CSV, screenshot or token staged; contributor
attribution preserved; each commit boots the app and its unit tests pass
(48 → 124 → 136 → 136). Base commit `133c48b` was **not** amended or force-pushed.

---

## 2. Git status (after Milestone C, uncommitted)

56 working-tree paths: **18 new**, **16 modified**, **22 deleted**. No secrets or
build artifacts (`front-end/build`, `front-end/.visual`, `back-end/var` removed;
`.visual/` gitignored). No stashes. HEAD still `2ac57ea`.

---

## 3. Files added / modified / deleted

### Added
| Path | Purpose |
|---|---|
| `front-end/src/styles/tokens.css`, `global.css` | Design tokens + reset. |
| `front-end/src/components/ui/` — `Icon.js`, `primitives.js`, `Modal.js`, `toast.js`, `ui.css`, `index.js`, `Modal.test.js` | The shared component system. |
| `front-end/src/components/AppShell.{js,css,test.js}` | Responsive application shell. |
| `front-end/src/lib/session.js` | `useSession()` / `currentSession()` from the JWT. |
| `front-end/src/lib/tollNames.js` | English station names (API/DB names are Greek). |
| `front-end/src/pages/LandingPage.{js,css}` + `.test.js` | Redesigned public landing. |
| `front-end/src/pages/OverviewPage.{js,css}` | New post-login dashboard. |
| `front-end/src/pages/AnalyticsPage.{js,css}` | Consolidated analytics (replaces StatsDashboard). |
| `front-end/src/pages/ForecastPage.{js,css}` | Redesigned forecast (replaces MachineLearning). |
| `front-end/src/pages/ProjectPage.{js,css}` | New public Project page. |
| `front-end/src/pages/pages.test.js`, `src/testUtils.js`, `src/journey.test.js` | Page tests + jsdom E2E. |
| `front-end/scripts/visual-check.mjs` | `npm run visual-check` — 4 viewports × 8 pages. |

### Modified
`front-end/src/App.js` (routing + shell + `AppRoutes` export), `App.test.js`,
`index.js` (token/global/ui CSS), `setupTests.js` (ResizeObserver / matchMedia
polyfills), `api/config.js` (`clearInvalidToken`), `pages/MapPage.{js,css}`
(restyle, English names, divIcon markers, detail panel, legend, states),
`pages/DebtsPage.{js,css}` (read-only redesign), `pages/LoginPage.{js,css}`
(redesign), `public/index.html` (title `TollAnalysis`, meta), `package.json` +
lockfile (removed 10 unused deps, added `puppeteer-core` devDep +
`visual-check` script), `.gitignore`, **`back-end/scripts/integration-db.sh`**
(readiness fix — see §10).

### Deleted (confirmed unused; build + tests pass without them)
`components/Header.{js,css,test.js}`, `pages/WelcomePage.{js,css,test.js}`,
`pages/StatsDashboard.{js,css}`, `pages/MachineLearning.{js,css}`,
`FileUpload.js`, `main.js`, `reportWebVitals.js`, `logo.svg`, `index.css`,
`styles/App.css`, `utils/utils.js`, `assets/tolll.webp`, `assets/troll.jpg.xmp`,
`public/map.html`, `public/stats.html`, `public/css/styles.css`.

---

## 4. Design-system summary

**Identity:** deep navy (`--navy-800 #0b2545`) primary, restrained teal
(`--teal-500 #12a5b8`) accent, slate neutrals, subtle 1px borders + soft shadows,
one gradient (brand mark only). System font stack (no web-font dependency).
Respects `prefers-reduced-motion`.

**Tokens (`tokens.css`):** colour scale + semantic roles, type scale
(`--text-xs`…`--text-3xl`), 4px spacing scale, radii, 4 shadow levels, layout
sizes, breakpoints, transitions, `--focus-ring`, and an 8-colour categorical
chart palette (`--chart-1`…`--chart-8`, `--chart-grid`, `--chart-axis`).

**Components (`src/components/ui/`):** `Button` (5 variants, sizes, loading),
`Card`, `StatCard`, `PageHeader`, `Field` (auto-wires `label`/`id`/
`aria-describedby`/`aria-invalid`), `Select`, `Input`, `DateRange` (native date
inputs), `Badge`, `Alert`, `Modal` (portal, focus-trap, ESC + backdrop, focus
restore), `Toast` + `ToastProvider`/`useToast`, `Skeleton`, `LoadingState`,
`EmptyState`, `ErrorState`, `Icon` (a single inline-SVG set — **no icon
dependency**). One stylesheet (`ui.css`). Plain CSS — **no Tailwind / Bootstrap /
MUI / Chakra**.

**Shell (`AppShell`):** persistent navy sidebar on desktop (brand, nav with
active state, user block, demo badge, sign-out); compact top bar + slide-in
drawer on mobile (drawer closes on navigation, ESC closes, focus moves in).
Content column `max-width: 1200px`, consistent padding. Skip-link as first
tab-stop.

---

## 5. Page-by-page changes

| Page | Before | After |
|---|---|---|
| **Landing** (`/`) | One sentence + a button that dropped you at `/stats` (→ login wall). | Eyebrow + headline + one-line value proposition; **primary "Explore Live Demo"** (tested backend flow) + secondary "View Project Details"; four capability cards (Interactive Toll Network / Traffic Analytics / Traffic Forecasting / Debt Optimization); a compact app-preview mock; "sample educational dataset" statement; a "Built with" tech row. Shows a "session ended" notice when redirected from an expired token. No credentials on the page. |
| **Overview** (`/overview`, new) | — | Demo lands here. Title + subtitle, four responsive stat cards (Operators, Toll stations — **live from `/api/tolls`**, Passages — *labelled static sample*, Debts settled — parsed from the optimization CSV), a real "toll stations by operator" bar chart, a numbered "Suggested demo journey", and an "About this data" note. Loading skeletons / error+retry. |
| **Toll Map** (`/map`) | Leaflet + clustering, Greek popup, external PNG marker image, fixed layout. | Same Leaflet + clustering (retained), on-brand `divIcon` markers (no external image), toolbar with Operator + Search filters, **selected-station detail panel** (English name, ID, contact, prices), legend, OSM attribution, loading / empty / error / no-match states, full-height responsive layout, mobile bottom-sheet detail. |
| **Traffic Analytics** (`/analytics`) | 4 separate tabs, 800px fixed charts, raw API terms, Greek. | One filter panel with a 3-mode selector (**Charges by operator / Operator pair / Single station** — every original analysis kept), sensible defaults that return data, **auto-runs on load**, summary stat cards above a responsive chart (titled, legended, tooltip, units) and a scrollable table, **CSV export**, loading / no-data / error states. |
| **Traffic Forecast** (`/forecast`) | Admin "train models" button exposed; fractional hours shown unexplained (`08:34`); Greek; Tailwind-lookalike classes. | Prominent **"Educational demonstration"** badge + amber limitation alert. Two clear sections — **Passage-volume forecast** (auto-runs; stations / total / busiest-station cards + per-station bar chart) and **Peak-hour prediction** (per-day line chart, **rounded to whole hours with an explicit note** about the circular-hour limitation, raw value in the table). No training control. No production-accuracy claims. Models unchanged. |
| **Debt Optimization** (`/debts`) | Depended on `PATCH /api/cancel_debts` (mutation); admin-only "Cancel Debts" button; Greek. | **Read-only.** "How this works" plain-English explainer; stat cards (settlement transfers / total to transfer / operators); before/after network images from `GET /api/get_debts_optimization`; optional interactive-graph toggle; **settlement instructions table** (Pays → Receives, Amount). No mutation control for anyone. "Precomputed sample result" badge. |
| **Project** (`/project`, new) | — | Problem statement, key features, architecture summary + diagram, technology stack, **NTUA origin**, **accurate attribution** (Stavros: REST API/backend, DB design, documentation, API functional testing, and later stabilisation/demo/UI work; original team: Thivaios, Liakis, Anastasiadis; explicit "not every feature was implemented by one person"), GitHub link + "Live demo (soon)" placeholder, honest ML-limitations alert. |
| **Sign in** (`/login`) | react-toastify, inline styles, background image. | Card layout with inline field validation + `autocomplete`, a recoverable form-level error, a divider, and an "Explore the live demo" path; toast on success; "Back to home". |
| **Global** | `alert()` for logout / errors / session expiry. | All `alert()` removed → `useToast` + `Alert` + state blocks. Expired session: token cleared, redirect to `/`, "session ended" notice, immediate demo re-entry. No raw stack traces / SQL / low-level messages surface. |

---

## 6. Before / after visual observations

- **Consistency:** one card style, one button system, one type scale, one
  spacing rhythm across every page (was: per-page inline styles + a fake-Tailwind
  CSS file + react-toastify + react-datepicker + react-select, three visual
  languages).
- **Language:** 100% English in the UI chrome and copy (station names now
  English via `tollNames.js`; the API/DB still store Greek).
- **Hierarchy:** every page has a single `<h1>` via `PageHeader` with a subtitle;
  summary stat cards precede detailed tables/charts.
- **Charts:** all responsive (`ResponsiveContainer` + `minWidth` + a `scroll-x`
  wrapper); titled, with legends, tooltips and units; brand chart palette. No
  fixed `width={800}`.
- **Demo framing:** a persistent "Demo mode — read-only" badge in the shell and a
  content banner; no admin/destructive control is rendered for demo users (and
  the backend enforces it regardless).
- **First-run:** demo visitor lands on a populated Overview dashboard, not a form.

---

## 7. Temporary review screenshots

`front-end/.visual/` (gitignored), 32 files: `{desktop,laptop,tablet,mobile}-{landing,login,overview,map,analytics,forecast,debts,project}.png`.
Regenerate any time with a running stack + `cd front-end && npm run visual-check`.

---

## 8. Responsive verification (all four required viewports)

`npm run visual-check` — headless Chromium, demo-authenticated for protected
pages, checks `documentElement.scrollWidth − clientWidth`:

| Viewport | Result |
|---|---|
| **1440 × 900** (desktop) | 8/8 pages: **no horizontal overflow**, no console errors, no failed requests |
| **1024 × 768** (laptop) | 8/8 pages: clean |
| **768 × 1024** (tablet) | 8/8 pages: clean — shell switches to top-bar + drawer, stat grids reflow to 2-up |
| **390 × 844** (mobile) | 8/8 pages: clean — single-column, touch-sized controls, map toolbar stacks, no clipped charts |

**32/32 combinations pass.** (An earlier pass flagged a Project-page overflow at
laptop +47px / mobile +192px from the architecture `<pre>`; fixed with
`min-width:0` on the grid columns + a `scroll-x` wrapper, re-verified clean.)

---

## 9. Accessibility checks

- **Keyboard:** first `Tab` focuses a visible "Skip to main content" link;
  `:focus-visible` ring on all interactive elements (token `--focus-ring`);
  mobile drawer opens/closes with the burger and ESC, focus moves to the first
  nav item.
- **Semantics:** one `<h1>` per page; `<nav aria-label="Main">`; `<main
  id="main-content">`; `role="dialog" aria-modal` + focus-trap + focus-restore in
  `Modal` (unit-tested).
- **Forms:** every control has an associated `<label>` (verified 3/3 on
  Analytics) via the `Field` wrapper; `aria-invalid` + `aria-describedby` on
  error; login inputs carry `autocomplete`.
- **Icons:** decorative icons `aria-hidden`; meaningful ones take a `title`.
- **Contrast:** navy/teal on white and white on navy meet WCAG AA for body text;
  muted text is `--slate-600` on white.
- **Motion:** `prefers-reduced-motion` zeroes transitions/animations globally.
- **Buttons vs links:** `Button` renders `<button>` for actions, `<a>`/`<Link>`
  for navigation; visually distinct.

---

## 10. Exact test / build / Docker results

| Check | Result |
|---|---|
| `git diff --check` | clean |
| **Backend unit** (`npm test`) | `Test Suites: 14 passed` · `Tests: 136 passed` |
| **Backend integration** (`npm run test:integration`, disposable DB) | `Tests: 15 passed, 1 skipped` (skip = ML forecast) |
| **Frontend** (`CI=true npm test`) | `Test Suites: 6 passed` · `Tests: 28 passed` (incl. `journey.test.js` — full landing→demo→overview→map→analytics→forecast→debts→project→sign-out in jsdom) |
| **Frontend production build** | `Compiled successfully.` — main JS **227.5 kB gz** (was 333 kB), CSS 13.4 kB gz |
| `docker compose config` | valid |
| **`docker compose up --build`** | image builds; `db` healthy ~40 s, `app` healthy ~13 s after; ran 3× during the milestone |
| **Live checks** | `/healthz` 200; demo-login → 90-min `demo` token; demo analytics/forecast 200; demo training 403; DB row counts **253 / 50 / 1002 unchanged** after the full journey; `<title>` = `TollAnalysis` |
| **Real-browser E2E** (Chromium) | landing → demo → overview (83 ms) → Toll Map → Analytics → Forecast (auto-ran) → Debt Optimization → Project → sign out (token cleared, back at `/`). |

**Test-infra fix (in scope):** `back-end/scripts/integration-db.sh` was reporting
"ready" while the `mysql:8` image's *temporary* init server was still running
(it runs the seed, then shuts down and restarts the real server), so integration
tests intermittently hit a closing connection. It now waits for the
`MySQL init process done` marker **and** a successful host-port query. Integration
tests are now deterministically green.

---

## 11. Browser-console and network errors

`npm run visual-check` across all 32 page/viewport combinations and the scripted
E2E journey: **zero page console errors, zero failed app requests.** The only
console output on any page is two React-Router-v6 "future flag" *informational*
warnings (pre-existing, benign). Server logs during the journey: clean — no
errors, secrets, tokens or SQL.

---

## 12. Known UI limitations

1. **Forecast bar heights** — the passage-volume model outputs small values
   (~1–2.5), so bars are visually short; the "busiest station" stat card carries
   the takeaway. Not a bug — real model output. (Value labels are a possible
   later polish.)
2. **Debt network graphs** are the pre-generated pyvis PNGs — small and sparse at
   card width. The settlement **table** is the primary artefact; the interactive
   graphs are available behind a toggle.
3. **`puppeteer-core`** added as a devDependency (64 packages) for
   `npm run visual-check`. Justified by the recurring visual-verification
   requirement; can be dropped if undesired.
4. **Analytics "Operator pair" / "Single station" modes** do not auto-run
   (only "Charges by operator" does) — they need user input (a station id / a
   second operator) to be meaningful.
5. **Station names** are English via a static map recovered from the original
   code; a station id with no mapping falls back to `Station <id>`.
6. Milestone A/B carry-overs unchanged: 1.28 GB image, Dockerfile `chown -R`
   first-build time, `ENFORCE_COMPANY_SCOPE` off by default, mixed
   `{error:"…"}` vs `{error:{code,message}}` API shapes.

---

## 13. Proposed Milestone C commit breakdown

*(nothing committed — for review)*

1. **`chore(frontend): remove dead prototype code`** — delete Header,
   WelcomePage, StatsDashboard, MachineLearning, FileUpload, main.js,
   reportWebVitals, logo.svg, index.css, styles/App.css, utils/utils.js,
   `public/{map,stats}.html` + `css/styles.css`, 2 unused assets; drop 10 unused
   dependencies.
2. **`feat(ui): design tokens and shared component system`** —
   `styles/tokens.css`, `styles/global.css`, `components/ui/*`, `index.js`
   wiring, `setupTests.js` polyfills, `Modal.test.js`.
3. **`feat(ui): responsive application shell and routing`** —
   `components/AppShell.*`, `lib/session.js`, `App.js` (+ `AppRoutes` export),
   `api/config.js` `clearInvalidToken`, `public/index.html` title/meta,
   `App.test.js`.
4. **`feat(ui): redesign landing, login and add the Overview dashboard`** —
   `pages/LandingPage.*`, `pages/LoginPage.*`, `pages/OverviewPage.*`,
   `lib/tollNames.js`, `LandingPage.test.js`.
5. **`feat(ui): redesign map, analytics, forecast and debt pages`** —
   `pages/MapPage.*`, `pages/AnalyticsPage.*`, `pages/ForecastPage.*`,
   `pages/DebtsPage.*`, `pages/ProjectPage.*`, `pages/pages.test.js`,
   `testUtils.js`.
6. **`test(frontend): jsdom visitor-journey e2e + visual-check script`** —
   `src/journey.test.js`, `front-end/scripts/visual-check.mjs`,
   `package.json` (`visual-check` script, `puppeteer-core` devDep), `.gitignore`.
7. **`fix(test): wait for the real mysql server in integration-db.sh`** —
   `back-end/scripts/integration-db.sh`.

---

## Acceptance criteria

| Criterion | Status |
|---|---|
| Milestone B committed in coherent commits | ✅ (4 commits, §1) |
| Application is consistently English | ✅ |
| Landing page communicates the product clearly | ✅ (headline + value prop + 4 caps + demo CTA) |
| "Explore Live Demo" works | ✅ (tested backend flow, E2E) |
| Demo starts at a useful overview | ✅ (`/overview` dashboard) |
| All major pages share a coherent design system | ✅ |
| Navigation works on desktop and mobile | ✅ (sidebar / drawer, drawer closes on nav) |
| Charts and maps are responsive | ✅ (no fixed widths; 32/32 viewport checks) |
| Loading, empty and error states exist | ✅ (every async view) |
| Browser alerts removed | ✅ (`useToast`) |
| Demo / read-only status visible | ✅ (shell badge + banner) |
| No destructive control exposed to demo users | ✅ (frontend + backend) |
| Project page includes accurate attribution | ✅ (tested) |
| No unintended horizontal overflow at the 4 viewports | ✅ |
| Backend unit + integration tests pass | ✅ 136 + 15/1skip |
| Frontend tests + production build pass | ✅ 28 + build |
| Docker Compose starts and becomes healthy | ✅ |
| Complete visitor journey works without console errors | ✅ |
| No ML methodology / external deployment changes mixed in | ✅ |

**No acceptance criterion failed.**
