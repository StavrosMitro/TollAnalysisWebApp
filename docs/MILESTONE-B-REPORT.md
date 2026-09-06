# Milestone B — Verification Report

Scope: safe public demo access, authorization correctness, reliable automated
tests. **No UI redesign, ML methodology rewrite, deployment, image
optimization, or README rewrite.** Nothing committed — awaiting review.

---

## 1. Milestone A checkpoint

**A checkpoint commit already exists**: `133c48b` *"corrections of code cleaning
etc"* by `stavrakas13 <stavros.mitro@hotmail.com>`, **and it has already been
pushed to `origin/portfolio-demo`** (this happened before the Milestone B
instructions arrived).

- I verified its contents are byte-identical to the Milestone A report: 51
  files, `config.js` / `authMiddleware.js` / `Dockerfile` / `docker-compose.yml`
  / `db/init` all as reported. `git diff main..133c48b -- Database_mysql/
  back-end/ml/ back-end/models_*` is empty — original datasets untouched.
- Re-ran the Part 1 validation against it: `git diff --check` clean; no `.env`,
  build output, `node_modules`, DB volume, runtime CSV, or `token.json` tracked;
  `.env.example` holds only explicitly local-only values; frontend build,
  backend tests (47 pass / 13 fail — the pre-existing suites), frontend tests
  (1/1), `docker compose config`, `docker compose up --build` → healthy,
  `/healthz` 200, login 200, `chargesBy` 200, `forecast` 200 — all match.

**I did not create a second checkpoint commit or amend `133c48b`.** The requested
message was `chore: establish reproducible portfolio demo baseline`; changing it
now would require `git push --force` on the already-pushed branch, which the
operating rules forbid. If you want the message changed, that is a one-time
`git commit --amend` + `git push --force-with-lease origin portfolio-demo` on
this solo branch — say the word and I'll do it, or do it yourself.

---

## 2. Git status after Milestone B

Branch `portfolio-demo`, HEAD still `133c48b`, **no new commits**, no stashes.
Working tree (45 paths):

- **Deleted**: `back-end/jest.config.js`, `back-end/testing/admin.test.js`,
  `back-end/testing/passing_toll.test.js`, `back-end/testing/tollStationPasses.test.js`
- **Renamed**: `back-end/testing/setupEnv.js` → `setup.unit.js`
- **Modified**: 24 files (see §3)
- **New**: 20 files/dirs (see §3)
- No secrets / build output / runtime artifacts tracked (verified).

---

## 3. Files changed

### New
| Path | Purpose |
|---|---|
| `db/init/03-demo-account.sql` | Adds `demo` to the `user_role` ENUM + seeds the fictional demo identity. |
| `back-end/jest.unit.config.js` / `jest.integration.config.js` | Split test configs. |
| `back-end/testing/setup.integration.js` | Fail-fast safety guard for DB-mutating tests. |
| `back-end/testing/helpers/tokens.js` | Signs test JWTs with the real config secret. |
| `back-end/testing/auth.test.js` | Login + demo-login + no-escalation + expiry (17 tests). |
| `back-end/testing/authorization.test.js` | The full role × capability matrix + company scope (52 tests). |
| `back-end/testing/healthcheck.test.js` | `/healthz` + admin healthcheck 401/403/200/503 (9). |
| `back-end/testing/admin_controller.test.js` | Rewrite of the old `admin.test.js`, mocked. |
| `back-end/testing/tollStationPasses_controller.test.js` | Rewrite, mocked. |
| `back-end/testing/passing_toll_controller.test.js` | Rewrite, mocked. |
| `back-end/testing/integration/smoke.test.js` | Real DB: demo journey, row-count invariant, cross-company, destructive-as-admin (16). |
| `back-end/scripts/integration-db.sh` | Disposable `toll_analysis_test` MySQL up/down/env. |
| `back-end/scripts/run-integration.sh` | `npm run test:integration` wrapper (fresh DB → jest → teardown). |
| `docs/AUTHORIZATION.md` | The enforced authorization matrix + company-scope note. |
| `docs/MILESTONE-B-REPORT.md` | This report. |
| `front-end/src/pages/WelcomePage.test.js` | Demo entry success / failure / no-double-submit. |
| `front-end/src/components/Header.test.js` | Logout clears token + returns to `/`. |

### Modified
| Path | Change |
|---|---|
| `back-end/config.js` | JWT secret ≥32 bytes + low-entropy guard; `demo` config (email/role/TTL, clamped 60–120 min); `disableDestructiveOps` + `enforceCompanyScope` as **live getters**. |
| `back-end/controllers/auth_controller.js` | New `demoLogin` (no input, demo identity only, minimal claims, 503 if unseeded). |
| `back-end/controllers/admin_controller.js` | `healthcheck` DB-down → **503** (was 401); no `error.message` leak. |
| `back-end/middlewares/authMiddleware.js` | `blockDestructiveOps` → **403 `DEMO_MODE_RESTRICTION`** (was 503); new `enforceCompanyScope(...params)` + `ROLE_TO_COMPANY` map. |
| `back-end/routers/auth_router.js` | `POST /auth/demo-login` route + `express-rate-limit` on login (30/15min) and demo-login (20/15min). |
| `back-end/routers/admin_router.js` | `blockDestructiveOps` added to the 4 user-admin routes. |
| `back-end/routers/{chargesBy,passesCost,passAnalysis,tollStationsPasses,forecast,peak_hour}_router.js` | `enforceCompanyScope('<opParam>')` inserted after `authorizeRole`. |
| `back-end/package.json` | `express-rate-limit@^7`; scripts `test` / `test:unit` / `test:integration` / `test:integration:jest`. |
| `docker-compose.yml` / `.env.example` / `back-end/.env.example` | 64-hex JWT default, `DEMO_TOKEN_TTL_MINUTES`, updated notes. |
| `front-end/src/api/config.js` | `isTokenValid()`, `requestDemoSession()`. |
| `front-end/src/App.js` | `PrivateRoute` checks token validity + clears an expired token; `setIsLoggedIn` passed to `WelcomePage`. |
| `front-end/src/pages/WelcomePage.js` + `.css` | "Explore Live Demo" button: loading / disabled / error states. |
| `front-end/src/App.test.js` | Real smoke test kept + `isTokenValid` + expired-token-redirect tests. |
| `docs/RUNNING.md` | Demo section + the three test commands. |

---

## 4. Authorization matrix (implemented + tested)

Full version: [`docs/AUTHORIZATION.md`](AUTHORIZATION.md). Enforced on the
backend by `authenticateToken` → `authorizeRole([...])` → `blockDestructiveOps` /
`enforceCompanyScope`.

| Capability | Visitor | Demo | Company | Admin |
|---|:--:|:--:|:--:|:--:|
| `GET /healthz` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/admin/healthcheck` | 401 | 403 | 403 | ✅ 200 / 503 |
| Landing + static | ✅ | ✅ | ✅ | ✅ |
| `GET /api/tolls` (public map) | ✅ | ✅ | ✅ | ✅ |
| Read analytics `passAnalysis / chargesBy / passesCost / tollStationPasses` | 401 | ✅ | ✅¹ | ✅ |
| Read forecasts `forecast / peak_hour` | 401 | ✅ | ✅¹ | ✅ |
| Debt-optimization figures | 401 | ✅ | ✅ | ✅ |
| Model training | 401 | 403 | 403 | 403² / ✅³ |
| Upload / import passages | 401 | 403 | 403 | 403² / ✅³ |
| Reset DB / stations / passes | 401 | 403 | 403 | 403² / ✅³ |
| Mutate / cancel debts | 401 | 403 | 403 | 403² / ✅³ |
| User administration | 401 | 403 | 403 | 403² / ✅³ |

¹ any operator by default; **own operator only** when `ENFORCE_COMPANY_SCOPE=true` (§9)
² `DISABLE_DESTRUCTIVE_OPS=true` (the bundled stack) → `403 {"error":{"code":"DEMO_MODE_RESTRICTION"}}`
³ `DISABLE_DESTRUCTIVE_OPS=false`

**Guarantee:** `demo` ∉ `ADMIN_ROLES`, so demo hits `403` on every destructive
route *before* `blockDestructiveOps`, regardless of the flag. Verified in both
flag states (`authorization.test.js`).

---

## 5. Demo token — claims and expiry

`POST /api/auth/demo-login` (no request body is read):

```json
// response
{ "token": "<jwt>", "role": "demo", "expiresIn": "90m" }

// decoded token claims — nothing else
{ "user_role": "demo",
  "user_email": "demo@toll-analysis.example",
  "iat": 1788719377,
  "exp": 1788724777 }          // exp - iat = 5400s = 90 min
```

- Signed with the **same** `config.jwtSecret` / algorithm as normal login.
- TTL = `DEMO_TOKEN_TTL_MINUTES` (default 90), clamped to **[60, 120]**.
- No `user_id`, no company, no permissions array, no admin data.
- Seeded identity: `demo@toll-analysis.example` (RFC 2606 reserved TLD),
  role `demo`, created deterministically by `db/init/03-demo-account.sql`. It is
  a **fictional platform-wide, read-only observer** (not a specific company) —
  the demo journey spans every operator's map/analytics/forecasts.
- Password column holds a bcrypt of a throwaway random value and is **never
  checked** (the endpoint takes no credentials).
- Rate-limited: 20 requests / 15 min / IP → `429 {"error":{"code":"DEMO_RATE_LIMITED"}}`.
- Returns `503 {"error":{"code":"DEMO_UNAVAILABLE"}}` (not 500/200) if the demo
  identity is missing or the DB is down.

---

## 6. Test architecture

```
back-end/
  jest.unit.config.js         testMatch testing/*.test.js   · setup.unit.js       · clearMocks
  jest.integration.config.js  testMatch testing/integration/*· setup.integration.js· maxWorkers 1

  npm test              = npm run test:unit  = jest --config jest.unit.config.js
  npm run test:integration = scripts/run-integration.sh:
        integration-db.sh up      -> fresh mysql:8 container "toll-analysis-integration-db",
                                     db "toll_analysis_test", host port 3399, seeded from db/init,
                                     waits for the host port to accept TCP
        source its env vars       -> NODE_ENV=test ALLOW_DESTRUCTIVE_TESTS=true DATABASE=…_test …
        jest --config jest.integration.config.js --forceExit
        trap: integration-db.sh down   (always)
  npm run test:integration:jest = jest only (assumes you exported the env yourself)
```

**Unit tests** — no DB, no Python, no real filesystem writes. `dbService`,
`child_process`, and `fs` are mocked per suite. Order-independent
(`clearMocks: true`; the two flags are read live so no module reloading).

**Integration tests** — `setup.integration.js` **calls `process.exit(1)`**
unless `NODE_ENV=test` AND `DATABASE` ends `_test` AND
`ALLOW_DESTRUCTIVE_TESTS=true` AND `DATABASE !== 'toll_analysis'`. The wrapper
creates its own throwaway container, so a stray run cannot touch the
compose/dev database. Serial. DB torn down on exit (even on failure).

**Admin healthcheck** corrected and pinned by `healthcheck.test.js`:
401 (no/invalid token) · 403 (non-admin) · 200 (admin + DB up) · **503** (admin + DB down).

---

## 7. Exact test / build results

| Check | Result |
|---|---|
| `git diff --check` | clean |
| **Backend unit** (`npm test`) | **`Test Suites: 14 passed`, `Tests: 136 passed`** (was 47 pass / 13 fail) |
| **Backend integration** (`npm run test:integration`, fresh disposable DB) | **`Tests: 15 passed, 1 skipped`** (skip = forecast, needs `INTEGRATION_ML=true`) |
| **Frontend** (`CI=true npm test`) | **`Test Suites: 3 passed`, `Tests: 12 passed`** |
| **Frontend production build** (`CI=true npm run build`) | `Compiled successfully.` exit 0 |
| **Docker image build** (`docker compose up --build`) | built; `db` healthy ~40s, `app` healthy ~13s later |
| `docker compose config` | valid |
| Safety guard | `NODE_ENV=production npm run test:integration` → `REFUSING TO RUN: NODE_ENV must be "test"` exit 1 |

Nothing is skipped to hide a failure; the one `it.skip` is the ML forecast
integration test, which is exercised instead against the live container in §8.

---

## 8. End-to-end demo verification (against `docker compose up --build`)

Browser E2E driven with headless Chromium (puppeteer-core, used transiently and
uninstalled — not committed):

| Step | Result |
|---|---|
| Landing page renders with **"Explore Live Demo"** button | ✅ (screenshot) |
| Click → `POST /api/auth/demo-login` → **200** → navigates to `/stats` | ✅ |
| Stored token role = `demo`, TTL = **90 min** | ✅ |
| Browser console on `/`, `/stats` | only 2 benign React-Router-v6 *info* warnings — **no errors** |
| Logout button → token cleared, back at `/` | ✅ |
| Expired token placed in `localStorage`, visit `/stats` → redirected to `/`, token cleared | ✅ |

API-level (curl against the stack), demo token:

| Request | Result |
|---|---|
| `GET /healthz` | 200 `{status:ok,database:up}` |
| `GET /api/tolls` · `chargesBy` · `passAnalysis` · `get_debts_optimization` | **200** |
| `GET /api/forecast/NAO/…` · `GET /api/peak_hour/NAO/…` | **200** (pre-trained models, container venv) |
| `POST /api/training`, `PUT /api/passing_toll`, `POST /api/upload_passages`, `POST /api/admin/reset{passes,stations}`, `PATCH /api/cancel_debts`, `GET /api/admin/users`, `POST /api/admin/usermod`, `GET /api/admin/healthcheck` | **403** (all 9) |
| demo-login × 25 rapid | `200 ×18 … 429 ×7` (rate limit) |
| `POST /api/logout` (valid demo token) | 200 · `whoami` → `{user_email:"demo@toll-analysis.example",user_role:"demo"}` |

Admin (curl):

| Request | Result |
|---|---|
| login `admin@yme.gov.gr` | 200 |
| `POST /api/training` with `DISABLE_DESTRUCTIVE_OPS=true` (stack default) | **403 `{"error":{"code":"DEMO_MODE_RESTRICTION"}}`** |
| `GET /api/admin/healthcheck` | 200 `{status:OK,n_stations:253,n_tags:50,n_passes:1002}` |

Company (`admin@neaodos.gr`, role `neaodos` = operator NO), curl:

| Request | Result |
|---|---|
| `GET /api/chargesBy/NO/…` (own) | 200 |
| `GET /api/chargesBy/AM/…` (other operator, flag OFF = stack default) | **200 — permissive (see §9)** |

**Row-count invariant** — `n_stations / n_tags / n_passes` = **253 / 50 / 1002
before and after** the entire demo journey (demo login, all reads, all denied
writes, logout, expiry) and after all API verification. Unchanged. The
integration suite asserts this too.

Server logs after the full run: clean — no errors, warnings, secrets, tokens, or
password hashes.

---

## 9. Cross-company authorization finding

**Current behaviour (default, and on the bundled stack): a company-role user can
read any operator's analytics / forecasts.** Confirmed live: `admin@neaodos.gr`
(operator `NO`) successfully `GET /api/chargesBy/AM/…`, `…/passAnalysis/AM/…`,
`…/tollStationPasses/AM01/…`.

Root cause: the operator id is a **URL parameter that selects** the operator
(`/api/chargesBy/:tollOpID/…`), and the controllers query by it. There is no
company binding in the JWT and no mapping from a company role to a `company_id`
anywhere in the original codebase. Combined with the shared educational sample
dataset, the original API design treats every operator's aggregate figures as
readable by any authenticated operator.

**What Milestone B did:**

1. **Documented** it (`docs/AUTHORIZATION.md`, this section).
2. **Regression test** pinning today's permissive behaviour, so any future change
   is deliberate (`authorization.test.js`, `integration/smoke.test.js`).
3. **Built the isolation, off by default**: `enforceCompanyScope(...opParams)`
   middleware + `ROLE_TO_COMPANY` map, wired into all six operator-scoped
   routers. With `ENFORCE_COMPANY_SCOPE=true`:
   - company user + own operator → allowed;
   - company user + another operator → **403 `COMPANY_SCOPE_RESTRICTION`**
     (verified live and in tests);
   - `admin` and `demo` unaffected (demo is a platform-wide observer);
   - the `aodos` role is **deliberately unmapped** — it corresponds to either
     AM or NAO and the codebase never resolved which — so it **fails closed**
     (403 on all scoped requests) until you decide.

It is left **OFF** because turning it on is a product decision (is it correct
that operators can see pairwise debt figures they are a party to? which company
is `aodos`? should the demo still be platform-wide?) and would change the API
contract mid-milestone. Flip `ENFORCE_COMPANY_SCOPE=true` to enable; resolve
`aodos` in `ROLE_TO_COMPANY` first.

---

## 10. Remaining failures / risks

1. **`ENFORCE_COMPANY_SCOPE` is OFF by default** — company users can still read
   other operators' data on the running stack. Deliberate (§9); needs your call.
2. **`aodos` → company_id is unresolved.** Fails closed under enforcement.
3. **ML forecast integration test is skipped** unless `INTEGRATION_ML=true` +
   a scikit-learn interpreter on the host. Forecast *is* verified against the
   container stack (§8).
4. **`Header.js` still uses `alert()`** for logout feedback (Phase 5). It works;
   headless browser automation must auto-accept the dialog.
5. **Dockerfile `chown -R node:node /app`** now takes ~4–5 min on first build
   (the bogus `npm`/`install` prod deps bloat `node_modules`). Build still
   succeeds; a `COPY --chown` fix is deferred (image work is out of scope).
6. **Rate-limit store is in-memory per process** — fine for one container;
   a multi-instance deployment needs a shared store, and `app.set('trust proxy')`
   behind a load balancer.
7. **`express-rate-limit` added** to `back-end/package.json` (+ lockfile). One
   new prod dependency.
8. Milestone A carry-overs unchanged: 1.28 GB image, legacy `public/*.html`
   shipped, `FileUpload.js` dead code, stale `openapi.json`, `chargesBy`
   400-for-no-data, `{error:"…"}` vs the new nested `{error:{code,message}}`
   shape used only for demo/scope responses.

---

## 11. Proposed commit breakdown for Milestone B

*(nothing committed yet — for your review)*

1. **`test: split unit / integration suites with a disposable-DB guard`**
   `jest.unit.config.js`, `jest.integration.config.js`, `testing/setup.*.js`,
   `testing/helpers/`, `scripts/integration-db.sh`, `scripts/run-integration.sh`,
   `package.json` scripts, delete `jest.config.js`, rename `setupEnv.js`.
2. **`test: replace stale integration suites with mocked unit tests`**
   delete `admin.test.js` / `passing_toll.test.js` / `tollStationPasses.test.js`,
   add `admin_controller.test.js` / `passing_toll_controller.test.js` /
   `tollStationPasses_controller.test.js`.
3. **`fix(auth): correct admin healthcheck status codes (401/403/200/503)`**
   `admin_controller.js` + `healthcheck.test.js`.
4. **`fix(security): require 32-byte JWT secret; 403 (not 503) for demo-mode block`**
   `config.js`, `authMiddleware.js` (`blockDestructiveOps`), `.env.example` ×2,
   `docker-compose.yml`.
5. **`feat(demo): POST /api/auth/demo-login with a seeded read-only identity`**
   `auth_controller.js`, `auth_router.js` (+ rate limiting), `config.js` (demo
   block), `db/init/03-demo-account.sql`, `package.json` (`express-rate-limit`),
   `auth.test.js`.
6. **`feat(authz): enforce the authorization matrix on the backend`**
   `admin_router.js` (user-admin guard), `authorization.test.js`,
   `docs/AUTHORIZATION.md`.
7. **`feat(authz): optional company-data scope (ENFORCE_COMPANY_SCOPE, default off)`**
   `authMiddleware.js` (`enforceCompanyScope` + `ROLE_TO_COMPANY`), the 6
   analytics routers, `config.js`, tests.
8. **`test: integration smoke — demo journey, row-count invariant, cross-company`**
   `testing/integration/smoke.test.js`.
9. **`feat(frontend): "Explore Live Demo" entry + token-expiry handling`**
   `api/config.js`, `App.js`, `WelcomePage.{js,css}`, `App.test.js`,
   `WelcomePage.test.js`, `Header.test.js`.
10. **`docs: RUNNING.md demo + test commands; Milestone B report`**

---

## Acceptance criteria

| Criterion | Status |
|---|---|
| Milestone A checkpoint committed | ✅ (`133c48b`, by you; §1) |
| Demo login requires no exposed credentials | ✅ (no body read; no cred in frontend) |
| Demo JWT has only the `demo` role + short expiry | ✅ (`{user_role:'demo'}`, 90 min) |
| Demo supports the representative read-only journey | ✅ (map, analytics, forecasts) |
| Demo users cannot cause persistent mutations / training | ✅ (403 on all; row counts unchanged) |
| Global demo mode blocks dangerous ops with `403` | ✅ (`DEMO_MODE_RESTRICTION`) |
| Unit tests need no real database | ✅ |
| Integration tests cannot accidentally target a non-test DB | ✅ (triple guard + own container) |
| Backend unit tests pass | ✅ 136/136 |
| Backend integration tests pass | ✅ 15/15 (+1 skip) |
| Frontend tests pass | ✅ 12/12 |
| Frontend production build passes | ✅ |
| Docker Compose starts successfully | ✅ |
| No secrets / runtime artifacts tracked | ✅ |
| No broad UI / ML changes mixed in | ✅ |
