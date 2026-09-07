# Milestone C — Visual-polish pass

A focused visual pass over the Milestone C redesign. The first result was
functionally complete but read like a generic AI-generated SaaS dashboard, with
no visual connection to roads, toll infrastructure or Greece. This pass adds
domain identity, flattens the data surfaces, cuts the card/badge noise, and
restores the interactive pyvis debt graphs.

**Nothing is committed.** No backend, auth, API, database, ML, routing or
demo-journey behaviour was changed. All tests still pass.

---

## 1. Milestone B commit hashes (unchanged)

Branch `portfolio-demo`, **not pushed**. HEAD is still `2ac57ea`.

| Hash | Message |
|---|---|
| `17743b6` | `test: isolate unit and disposable database integration suites` |
| `8ec7698` | `fix(security): strengthen authentication and authorization controls` |
| `f2cb0dc` | `feat(demo): add safe read-only portfolio access` |
| `2ac57ea` | `docs: document demo authorization and verification` |

Base commit `133c48b` (Milestone A, already pushed) was **not** amended or
force-pushed.

---

## 2. Git status

All Milestone C work (original redesign + this polish pass) is uncommitted on
`portfolio-demo`. No secrets, build output, `node_modules`, DB volumes, runtime
CSV or screenshots are staged or tracked. `front-end/.visual/` is gitignored.

Files created in this polish pass:
`front-end/src/lib/operators.js`, `front-end/src/components/ui/BrandMark.js`,
`front-end/src/components/NetworkGlyph.js`,
`front-end/src/components/BrowserFrame.{js,css}`,
`front-end/src/assets/{motorway-egnatia-1600,motorway-egnatia-800,shot-map,shot-overview,shot-analytics}.webp`,
`docs/THIRD_PARTY_ASSETS.md`, `docs/MILESTONE-C-POLISH-REPORT.md`.

Files changed substantially in this pass (still untracked / uncommitted from
Milestone C — nothing is staged):
`front-end/src/styles/tokens.css`, `front-end/src/components/ui/{ui.css,index.js}`,
`front-end/src/components/AppShell.{js,css}` + `AppShell.test.js`,
`front-end/src/pages/{Landing,Login,Overview,Analytics,Forecast,Debts,Project,Map}Page.{js,css}`,
`front-end/src/journey.test.js`, `front-end/src/pages/{pages,LandingPage}.test.js`,
`front-end/scripts/visual-check.mjs`.

Images removed: the AI-generated `tollll.webp` and the unlicensed `troll.jpg`
(+ its `.xmp` sidecar). See §7.

---

## 3. Design-system changes

| Area | Before (generic) | After (this pass) |
|---|---|---|
| **Brand mark** | `activity` pulse/wave icon — reads as medical/health. | Original inline SVG (`BrandMark.js`): a motorway trunk that forks at an interchange with a data point at the junction. Legible at 24–32 px; works white-on-navy and navy/teal; `badge` variant sits in a navy-gradient tile. No external generator, no copied logo. Name stays **TollAnalysis**. |
| **Radii** | 6 / 10 / 14 px | 5 / 8 / 10 px |
| **Shadows** | `sm` on every card | Cards are flat (border only); `--shadow-md`/`lg` reserved for the summary-metric strip, the browser frames and the mobile drawer. |
| **Sidebar** | 248 px, large teal **pill** active state | 220 px; active state = subtle lighter surface + a 3 px teal left edge + teal icon + `#fff` label. No pill. |
| **Demo indicator** | Large `Demo mode — read-only` badge repeated at the top of every internal page + a second one in the shell. | One compact block in the sidebar footer: a small pulsing teal dot + "Demo visitor" + "Read-only · sample data". The per-page banner is **removed**. |
| **StatCards** | Shadowed, icon per card | Flat, `--radius-md`, uppercase tracked label, tabular-nums value, no automatic icon. |
| **Section wrapper** | Everything inside a floating `Card` | New `.ui-section` — a flat block separated by space + a bottom-bordered `<h2>`. Cards are used only where content is genuinely grouped. |
| **Operator colour** | Chart colours assigned by array index — different per page; map markers a single uniform teal. | `src/lib/operators.js` is the single source of truth for operator code → label → colour. **Overview, Analytics, Debt Optimization, and now the Toll Map markers + legend all use the same colour for the same operator.** |
| **Typography** | one flat scale | Added `--text-3xl/4xl`, tight tracking and `leading-tight/snug`; page titles are `--text-3xl` with a bottom rule; capability/section copy trimmed. |

New helper components: `NetworkGlyph` (projects the real station coordinates to
an SVG, coloured by operator — the shape of the motorway network without a
basemap) and `BrowserFrame` (a restrained browser chrome around a product
screenshot).

---

## 4. Page-by-page

### Landing (`/`)
Editorial, product-led hero on a **real photograph of the Egnatia Odos motorway**
(Wikimedia Commons, public domain — §7) under a strong navy scrim, with an actual
**Toll Map screenshot** in a browser frame layered over it. Copy column ≈45 %:
eyebrow, one-line headline, short value proposition, a compact data line
(**8 operators · 253 toll stations · interactive analytics & ML forecasting**),
primary **Explore Live Demo** + secondary **View Project**, and a quiet
"read-only session on a fixed educational sample dataset" note. Below the hero: a
varied capabilities section — one lead feature (the map) with an Analytics
screenshot, then three short supporting items. The old fake-dashboard mock and
the row of four identical capability cards are gone.

### Login (`/login`)
Desktop split screen: visual panel ≈56 % (same motorway photo + scrim + brand +
one sentence on interoperable toll-network analytics + three facts + a Toll Map
screenshot); sign-in panel ≈44 % (normal operator sign-in preserved with
accessible validation and `autocomplete`, then a visually distinct **"Just
exploring?" → Explore the live demo** block). Mobile: one column, a short cropped
photo header (~180 px) with the brand, then the form immediately — not pushed
below a full-height image.

### Overview (`/overview`)
Bridges the visual landing and the data app: a navy **network strip** (the
`NetworkGlyph` — real station coordinates, operator-coloured) with headline
metrics as a flat definition list beside it (no identical stat cards). Then a
flat "Toll stations by operator" bar chart with **operator colours + direct value
labels**, the numbered demo journey, and the data-provenance note.

### Traffic Analytics (`/analytics`)
The filter panel now reads as a professional analysis toolbar: a segmented
**By operator / Operator pair / Single station** control, one row of inputs, a
**Run** button, and a one-line description of the active mode. Results are flat
(no cards-in-cards): a result title + CSV button, a small summary-metric strip, a
**horizontal bar chart with direct € value labels and stable operator colours**,
then the table (operator colour swatches). Responsive + CSV export retained.

### Traffic Forecast (`/forecast`)
The dominating amber warning box is replaced by a compact **"Educational model"**
status chip in the page header plus an accessible `<details>` disclosure
("Model details and limitations") that still states, verbatim, that the outputs
are **not production-grade predictions**, that peak-hour regression ignores the
23:00 / 00:00 adjacency, and that no confidence intervals are shown. Visual
priority goes to the controls, the result summary, the busiest station and the
chart. Bars and the peak-hour line carry **direct value labels**; the Y-axis
uses an honest scale; the model is unchanged.

### Debt Optimization (`/debts`)
**Interactive pyvis graph restored** as the primary visual (`<iframe srcDoc>`
with a Before / After-optimization toggle) — drag nodes, scroll to zoom, edge
labels are the € owed. PNG figures are the fallback if the HTML is unavailable.
Below it, the settlement-instructions table with operator-colour squares. Still
read-only — no mutation control for anyone. The frontend strips three dead local
references from the pyvis export (`lib/bindings/utils.js`, a commented local
`vis.js`, a mis-pathed stylesheet) and corrects one vis-network option key; the
graph data and layout are untouched.

### Project (`/project`)
Concise and editorial: a lead paragraph + one Overview screenshot in a browser
frame, a compact "How it works" architecture block, a "Built with" definition
list, a short contributors section, and one ML-limitations warning. Attribution
unchanged and accurate — **Stavros** (REST API/backend, DB design, documentation,
API functional testing, then the stabilisation/demo/UI work) and the original
team **Dimitris Thivaios, Dimitris Liakis, Vassilis Anastasiadis**, with the
explicit "not every feature was implemented by one person". No long grid of
cards/badges.

---

## 5. Variant A vs Variant B

Both were built behind a temporary `?variant=` switch, rendered at 1440×900 and
390×844, compared, and the rejected one removed.

| | **A — Product-led** | **B — Domain-led** *(selected)* |
|---|---|---|
| Hero visual | Toll Map screenshot in a browser frame on a navy ground with a faint CSS road motif; no external photo. | Real Egnatia Odos motorway photograph + navy scrim, Toll Map screenshot layered over it. |
| Feels less generic | Better than the original, but still "navy SaaS". | **Immediately reads as Greek motorways / toll infrastructure** — answers the core complaint. |
| Product credibility | Screenshot front-and-centre. | Screenshot still prominent, over a real-world backdrop that is hard to fake. |
| Stock-photo cliché risk | None. | Low — it is the *specific* motorway of one of the eight operators, not a generic highway; used with restraint (heavy scrim, product screenshot on top). |
| Weight (above the fold) | ~110 KB (one screenshot). | ~168 KB mobile / ~236 KB desktop (photo via `srcset` + one screenshot). |
| Licensing surface | None. | One file, public domain, fully documented in `docs/THIRD_PARTY_ASSETS.md`. |
| Mobile legibility | Dark text on white — slightly easier. | White text on a scrimmed photo — verified legible at 390 px. |

**Selected: Variant B.** The single thing the review asked for was domain
identity at the public entry points ("no visual connection to roads, toll
infrastructure, or Greece"). Variant B delivers that with a genuine, properly
licensed photograph while still showing the real product; the extra ~60–130 KB is
acceptable for a portfolio landing and is `srcset`-scaled for mobile. Variant A's
CSS road motif and the `?variant` switch were removed; `NetworkGlyph` (the other
"road/network geometry" idea) survives as the Overview network strip.

---

## 6. Frontend asset-size impact

| | Pre-polish MS-C | Post-polish | Δ |
|---|---|---|---|
| main JS (gzip) | 227.5 kB | 228.0 kB | +0.5 kB |
| main CSS (gzip) | 13.4 kB | 14.4 kB | +1.0 kB |
| bundled images | 0 | 5 WebP files, ~348 kB total | +348 kB |

Images actually fetched:

| File | Size | When |
|---|---|---|
| `motorway-egnatia-1600.webp` | 126 kB | Landing + Login hero (desktop) |
| `motorway-egnatia-800.webp` | 58 kB | Landing + Login hero (≤ 800 px via `srcset`) |
| `shot-map.webp` | 113 kB | Landing + Login hero (eager) |
| `shot-analytics.webp` | 32 kB | Landing capabilities (`loading="lazy"`) |
| `shot-overview.webp` | 27 kB | Project page (`loading="lazy"`) |

Above-the-fold image weight: **~240 kB desktop / ~170 kB mobile** on the landing
page; the same on login. All WebP, all sized to their display box, every `<img>`
carries explicit `width`/`height` (or `object-fit: cover` on a fixed box) so
there is **no layout shift**. The unused progressive-JPEG fallback was deleted.

---

## 7. Image sources & licensing

Full detail in **`docs/THIRD_PARTY_ASSETS.md`**.

| Asset | Source | Licence |
|---|---|---|
| `motorway-egnatia-1600.webp`, `-800.webp` | Wikimedia Commons — [`File:Egnatia_Odos.JPG`](https://commons.wikimedia.org/wiki/File:Egnatia_Odos.JPG), author *Murderdoll1122* | **Public domain** (released by the copyright holder). Cropped, resized, re-encoded to WebP, EXIF stripped. Real photo, no readable plates, no unrelated brands. |
| `shot-map.webp`, `shot-overview.webp`, `shot-analytics.webp` | Captured from this app's own production Docker build (demo session), 1200×760 → resized 1200 px → WebP | First-party. Map tiles © OpenStreetMap contributors (ODbL) — attribution shown on the map. |

**Deleted** (were in `src/assets/`): `tolll.webp`, `tollll.webp` (visibly
AI-generated), `troll.jpg` + `troll.jpg.xmp` (unknown provenance/licence). No
image was taken from Google Images, a stock site, or any source without an
explicit reusable licence.

---

## 8. Verification

_Filled from the final run — see §9 for the one open item._

| Check | Result |
|---|---|
| Frontend unit + journey tests (`CI=true npm test`) | `Test Suites: 6 passed` · `Tests: 28 passed` |
| Frontend production build | `Compiled successfully.` — 228.0 kB gz JS / 14.4 kB gz CSS |
| Backend unit (`npm test`) | `Test Suites: 14 passed` · `Tests: 136 passed` |
| Backend integration (`npm run test:integration`, disposable DB) | `Tests: 15 passed, 1 skipped` |
| `docker compose up --build` | image builds; `db` healthy, `app` healthy; rebuilt repeatedly during the pass |
| Live demo visitor journey | landing → demo-login (90-min `demo` token) → overview → map → analytics → forecast → debts → project → sign out; all 200, no destructive controls rendered |
| `npm run visual-check` (4 viewports × 8 pages = 32) | **32/32 clean** — no horizontal overflow, no console errors, no failed app requests |
| Demo user sees no destructive controls | confirmed (frontend renders none; backend still enforces `DEMO_MODE_RESTRICTION`) |
| API / backend / DB / auth / routing / ML unchanged | confirmed — this pass only touched `front-end/src/**`, `front-end/scripts/visual-check.mjs`, and docs |
| Image licence documentation | `docs/THIRD_PARTY_ASSETS.md` present and complete |
| Images compressed / no CLS | all WebP, sized to box, explicit dimensions |

### Console / network

Across all 32 page/viewport combinations: **zero page console errors, zero failed
app requests.** The only console output anywhere is the two pre-existing,
informational React-Router-v6 "future flag" warnings.

The pyvis iframe previously showed a blocked request for `lib/bindings/utils.js`
and a stylesheet MIME warning — fixed by stripping those dead references from the
pyvis export in `cleanGraphHtml`. A `SecurityError` for `localStorage` on
`/debts` turned out to be an artifact of `visual-check.mjs` itself injecting the
demo token into *every* frame, including the sandboxed graph iframe; the
injection is now guarded to the top document, and a real browser never hit it.

---

## 9. Known limitations

1. **Forecast values are small** (~1–2.5 passages) so the bars are short even with
   an honest scale; direct value labels + the "busiest station" card carry the
   number. Real model output — not changed.
2. **`puppeteer-core`** remains a devDependency for `npm run visual-check`.
3. **Analytics "Operator pair" / "Single station"** modes do not auto-run — they
   need a station id / second operator to be meaningful. "By operator" auto-runs.
4. The pyvis graph loads **vis-network and Bootstrap from their CDNs** (as the
   export is authored); it renders the network on a `<canvas>` and works without
   the stripped local helper. The iframe keeps `sandbox="allow-scripts"` only.
5. Milestone A/B carry-overs unchanged (image size, `ENFORCE_COMPANY_SCOPE` off by
   default, mixed API error shapes).

---

## 10. Review screenshots

`front-end/.visual/` (gitignored, 32 files) — regenerate with a running stack +
`cd front-end && npm run visual-check`. A trimmed review set (desktop + mobile
landing and login, desktop overview / analytics / forecast / debts / project /
map, and the open mobile nav drawer) was also captured alongside this report.

The temporary Variant A/B landing + login comparisons (1440×900 and 390×844) were
captured before the rejected variant was removed:
`desktop-landing-A|B[-full].png`, `mobile-landing-A|B.png`,
`desktop-login-A|B.png`, `mobile-login-A|B.png`.

---

## 11. Proposed commit breakdown (this pass — nothing committed)

To fold into the Milestone C commits from `docs/MILESTONE-C-REPORT.md` §13, or as
follow-ups:

1. **`feat(ui): road brand mark, flatter tokens, stable operator colours`** —
   `BrandMark.js`, `tokens.css`, `ui.css`, `lib/operators.js`, `ui/index.js`.
2. **`feat(ui): restrained app shell — narrow sidebar, compact demo state`** —
   `AppShell.{js,css}`, `AppShell.test.js`.
3. **`feat(ui): domain-led landing and login on a licensed motorway photo`** —
   `LandingPage.{js,css}`, `LoginPage.{js,css}`, `BrowserFrame.{js,css}`,
   `assets/*`, `docs/THIRD_PARTY_ASSETS.md`, `LandingPage.test.js`.
4. **`feat(ui): flatten overview, analytics and forecast; value labels`** —
   `OverviewPage.*`, `AnalyticsPage.*`, `ForecastPage.*`, `NetworkGlyph.js`,
   `pages.test.js`, `journey.test.js`.
5. **`feat(ui): restore interactive pyvis debt graphs`** — `DebtsPage.{js,css}`.
6. **`refactor(ui): concise editorial project page`** — `ProjectPage.{js,css}`.
7. **`fix(test): scope visual-check token injection to the top frame`** —
   `scripts/visual-check.mjs`.
