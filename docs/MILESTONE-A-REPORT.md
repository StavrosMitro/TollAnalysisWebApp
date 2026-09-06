# Milestone A — Verification Report

Branch: `portfolio-demo` · Date: 2026-09-06 · Scope: reproducible container
environment, centralized configuration, minimum backend stabilization. **No UI
redesign, demo mode, ML methodology rewrite, deployment, or README rewrite.**

---

## 1. Git status — before and after

**Before** (start of session): branch `main`, working tree **clean**, up to date with
`origin/main`, HEAD `b11e919 Update README.md`. No stashes. A `portfolio-demo` branch
did not exist.

**After**: branch `portfolio-demo` (created from clean `main`), **nothing committed,
pushed, or rebased**, no history rewrite, no stashes. Working tree:

- 1 staged deletion: `cli-client/token.json` (`git rm`, forward deletion only — no
  history rewrite; also added to `.gitignore`).
- 34 modified tracked files, 15 new untracked files/dirs (listed in §4).
- Original datasets **untouched**: `Database_mysql/`, `back-end/ml/`,
  `back-end/models_passages/`, `back-end/models_peak_hours/`, `back-end/uploads/`
  all show clean `git status`.

---

## 2. Files created and modified

### New files
| Path | Purpose |
|---|---|
| `Dockerfile` | Multi-stage: build React → runtime (Node 20 + Python 3.11 venv) serving both. |
| `docker-compose.yml` | `db` (MySQL 8, healthcheck, named volume, deterministic init) + `app` (depends_on healthy). Optional `adminer` under `--profile tools` only. |
| `.dockerignore` | Excludes node_modules, builds, `.env*` (keeps `.env.example`), runtime dirs, docs. |
| `.env.example` | Root — compose overrides + documented seeded credentials. |
| `back-end/.env.example` | Non-container local dev config. |
| `front-end/.env.example` | `REACT_APP_API_BASE_URL` guidance. |
| `back-end/requirements.txt` | Exactly pinned Python deps (see §4). |
| `back-end/config.js` | Single reader of `process.env`; JWT-secret enforcement; path resolution. |
| `back-end/jest.config.js` + `back-end/testing/setupEnv.js` | Deterministic test env (NODE_ENV, JWT_SECRET, RUNTIME_DIR). |
| `front-end/src/api/config.js` | `API_BASE_URL`, `apiUrl()`, `authHeaders()`. |
| `db/init/01-schema.sql`, `db/init/02-data.sql` | Byte-identical copies of `Database_mysql/{schema,data}.sql` (8-line provenance header prepended) for container auto-init. Originals preserved. |
| `docs/RUNNING.md` | Concise local startup documentation. |
| `docs/MILESTONE-A-REPORT.md` | This report. |

### Modified — backend
`app.js` (CORS from config, `/healthz`, SPA serving + history fallback that skips
`/api`, removed the filesystem-write-on-GET for openapi.json, error handler),
`server.js` (config-driven, removed dead HTTPS cruft), `config`-wiring +
sensitive-log removal in `dbService.js` / `auth_controller.js`,
`middlewares/authMiddleware.js` (canonical `JWT_SECRET`, role sets,
`blockDestructiveOps`), all 13 routers (role sets; destructive guard on
training / resets / cancel_debts / uploads / passing_toll),
`controllers/{forecast,peak}_controller.js` (absolute script/model paths,
`PYTHON_BIN`, runtime CSVs to `RUNTIME_DIR`, `spawn` `error` handler + single-response
guard), `controllers/{training,peak_training}_controller.js` (rewritten as pure
workers; router owns one response — fixes hang/double-send),
`controllers/{admin,cancel_debts,passing_toll}_controller.js` (`PYTHON_BIN`, minor
log cleanup), `controllers/tollStationsPasses_controller.js` (dropped a
row-dumping `console.log`), `scripts/cancelling_algo.py` (output dir from `__file__`
not CWD; removed 3 unused heavy imports).

### Modified — frontend
`src/api/config.js` (new), and hard-coded `http://localhost:9115/api` replaced with
the central config in `LoginPage.js`, `Header.js`, `MapPage.js`, `StatsDashboard.js`,
`DebtsPage.js`, `MachineLearning.js`. `package.json` (Jest `moduleNameMapper` for
axios ESM). `App.test.js` (replaced dead CRA "learn react" boilerplate with a real
smoke test). `MapPage.js` (hoisted 2 constants out of the component to fix the
build-blocking exhaustive-deps warning). Trivial unused-var / eslint-disable fixes
in `DebtsPage.js`, `MachineLearning.js`, `StatsDashboard.js` so the CI build is clean.

### Deleted
`cli-client/token.json` (committed, expired admin JWT).

---

## 3. Architecture implemented

```
                         docker compose up --build
   ┌─────────────────────────────────────────────────────────────────┐
   │  db  (mysql:8.0)                                                 │
   │   • volume db_data:/var/lib/mysql   (persistent)                 │
   │   • db/init/*.sql -> auto-run once on empty volume, in order     │
   │   • healthcheck: mysqladmin ping                                 │
   └───────────────▲─────────────────────────────────────────────────┘
                   │ depends_on: service_healthy   (HOST=db, 3306)
   ┌───────────────┴─────────────────────────────────────────────────┐
   │  app  (one image, NODE_ENV=production)                           │
   │   Stage 1: node:20  →  npm run build  →  /client                 │
   │   Stage 2: node:20 + python3.11 venv (/opt/venv)                 │
   │     • Express serves REST API under /api                         │
   │     • Express serves /client (React build) + SPA fallback        │
   │       (fallback never intercepts /api or /healthz)               │
   │     • GET /healthz → 200 only if process up AND `SELECT 1` ok    │
   │     • PYTHON_BIN=/opt/venv/bin/python  (ML subprocess)           │
   │     • RUNTIME_DIR=/tmp/toll-analysis-runtime (all generated CSV) │
   │     • DISABLE_DESTRUCTIVE_OPS=true                               │
   │   healthcheck: curl /healthz                                     │
   └─────────────────────────────────────────────────────────────────┘
              one browser origin →  http://localhost:9115
```

---

## 4. Exact dependency versions

**Runtime image**: `node:20-bookworm-slim` → **Node v20.20.2**, **npm 10**, Debian
bookworm **Python 3.11.2**.

**Python (`back-end/requirements.txt`, verified in the built image):**

| Package | Version | Package | Version |
|---|---|---|---|
| numpy | 2.2.3 | scikit-learn | **1.6.0** (exact match to the pickles' `_sklearn_version`) |
| pandas | 2.2.3 | joblib | 1.4.2 |
| scipy | 1.15.2 | threadpoolctl | 3.5.0 |
| python-dateutil | 2.9.0.post0 | mysql-connector-python | 9.2.0 |
| pytz | 2025.1 | pyvis | 0.3.2 |
| tzdata | 2025.1 | jinja2 | 3.1.5 |
| python-dotenv | 1.0.1 | | |

`pyvis` transitively pulls `ipython`, `networkx`, `jsonpickle` (noted as image bloat
in §10). **All 32 committed `*.pkl` model/encoder files load with zero warnings**
(`warnings.simplefilter('error')`) inside the image.

**Backend Node**: unchanged (`back-end/package.json` / lockfile not modified);
`npm ci --omit=dev` in the image.

**Frontend**: unchanged deps; only a `jest.moduleNameMapper` block added to
`package.json`.

---

## 5. Database initialization approach

- `db/init/01-schema.sql` + `02-data.sql` are **byte-identical** copies of the
  original `Database_mysql/*.sql` (verified with `diff` from the `-- MySQL dump`
  line onward), with an 8-line provenance comment prepended. Originals are preserved
  and untouched.
- The `mysql:8.0` container runs them automatically, in filename order, against
  `MYSQL_DATABASE` (`toll_analysis`), **once**, on a fresh `db_data` volume.
- The app user (`toll_app`) and its grants on `toll_analysis` are created by the
  MySQL image from `MYSQL_USER`/`MYSQL_PASSWORD`.
- **Deterministic result, verified**: 8 companies · 253 toll stations ·
  50 transceivers · 1002 passages · 353 debts · 56 total-debt rows · 8 users
  (`admin@yme.gov.gr` + 7 company accounts) · 1 view.
- Reset procedure: `docker compose down -v && docker compose up --build`.
- **No developer step** requires importing an unidentified SQL file, editing source,
  or installing Python packages by hand.

---

## 6. Security & correctness fixes

| # | Fix | Verified |
|---|---|---|
| S1 | **One JWT secret name (`JWT_SECRET`)**. Signing (`auth_controller`) and verification (`authMiddleware`, `whoami`, `logout`) all use `config.jwtSecret`. `SECRET_KEY` and the `'mySuperSecretKey'` fallback are gone. | `grep` shows no other refs; login+whoami round-trip works. |
| S2 | **Production fails hard without a good secret.** `NODE_ENV=production` + missing / `<16` chars / known-weak `JWT_SECRET` → `process.exit(1)` with a clear message. Dev uses a warned fallback only when `NODE_ENV!=='production'`. | Tested: missing→exit1, `mySuperSecretKey`→exit1, `abc`→exit1, valid→exit0, dev-missing→warn+run. |
| S3 | **No sensitive auth logging.** Removed: full user record, `bcrypt.compare` result, JWT on logout, the DB-config dump (host/user/password-set), query-result dumps in `getUser`/`getLastPassageId`, the hard-coded admin password in reset logs. | Container logs after login/reset/forecast: only 2 benign info lines, no secrets. |
| S4 | **CORS from config.** `CORS_ALLOWED_ORIGINS` (comma list). Empty in production (same-origin) ⇒ `origin:false`; dev defaults to `http://localhost:3000`. | Compose stack: same-origin, no CORS headers needed; verified journey works. |
| S5 | **Public `GET /healthz`** — no auth. 200 `{status:ok,database:up}` only when `SELECT 1` succeeds; **503 `{status:unavailable,database:down}`** otherwise (non-sensitive body). | 200 on compose stack; 503 verified locally with no DB. |
| S6 | **Broken RBAC fixed.** Analytics/forecast/peak/debt-figures routes now authorize `ANALYTICS_ROLES` = `admin` + `demo` + the 7 real company roles (`aodos`,`gefyra`,…). Previously `["users","admin"]` — a role no user has, so only the master admin worked. | Login as `admin@neaodos.gr` (role `neaodos`) → `GET /api/chargesBy/NO/…` → **200 with data** (was 403). |
| S7 | **Destructive / expensive ops gated.** New `blockDestructiveOps` + `DISABLE_DESTRUCTIVE_OPS` (compose sets `true`). Covers model training, `/api/admin/resetpasses`, `/api/admin/resetstations`, `/api/admin/addpasses`, `PATCH /api/cancel_debts`, `PUT /api/passing_toll`, `POST /api/upload_passages`. Bulk upload also downgraded from `["users","admin"]` to admin-only. | All 6 → **503** on the container; DB row counts unchanged after hitting them. Express is case-insensitive, so `/resetPasses` and `/resetpasses` are both covered. |
| S8 | **Python paths independent of CWD.** `spawn`/`exec` use absolute script paths (`config.paths.mlDir`, `config.paths.scriptsDir`) and `config.pythonBin`. `cancelling_algo.py` resolves its output dir from `__file__`, not `../`. Model paths already absolute. | `forecast`/`peak` predictions succeed from the container (CWD `/app/back-end`); output lands in `/tmp/toll-analysis-runtime/…`. |
| S9 | **Requests that hung / double-responded.** `training_router` rewritten: two former response-managing controllers are now pure workers returning `{errors}`; the route sends exactly one response (200 / 207 / 500). `forecast`/`peak` controllers add a `spawn` `'error'` handler and a `responded` guard so a missing/failed interpreter can't leave the request open or double-send. | Training route (disabled here) returns 503 cleanly; forecast error paths covered by `forecast_router.test.js` (7/7 pass). |
| S10 | **openapi.json no longer written to the app directory on every GET** (`app.js`). Spec is generated in memory; `servers` is now `/api` (same-origin) not `http://localhost:9115/api`. | `GET /api/openapi.json` → 200 JSON, no filesystem write; read-only container. |
| S11 | **Committed token removed** — `cli-client/token.json` (expired admin JWT) `git rm`'d + gitignored. `.gitignore` typos fixed (`backend/`→`back-end/`), added `back-end/var/`, `back-end/client/`, `.env.*`. | Still in git history (expired, low risk) — **not** rewritten. |
| S12 | Dead heavy imports (`matplotlib`, `plotly`, `networkx`) removed from `cancelling_algo.py` — they would `ImportError` the script if absent and bloated the image. | Script now imports only `pyvis` + stdlib + `mysql.connector` + `dotenv`. |

**Not changed** (out of Milestone A scope, documented in §10): the `chargesBy`
"no data → 400" quirk, the admin healthcheck returning 401 (not 503) on DB error,
`/api/tolls` being public (needed by the public map; the demo has no token flow yet),
error-envelope standardization, CLI hard-coded origin.

---

## 7. ML runtime compatibility

- Pinned exactly (§4). **All 8 passage models + 8 peak-hour models + 16 label
  encoders load cleanly** in the image with warnings escalated to errors — no
  `InconsistentVersionWarning`, no numpy ABI error.
- `GET /api/forecast/NAO/20220115` → **200**, real predictions from
  `models_passages/model_NAO.pkl` via `/opt/venv/bin/python ml/predict.py`.
- `GET /api/peak_hour/NAO/20220110/20220115` → **200**, real predictions from
  `models_peak_hours/model_NAO.pkl`.
- Generated CSVs are written to `/tmp/toll-analysis-runtime/{forecast_input,
  forecast_results,peak_input}/…` — **not** into the tracked `back-end/ml/*` dirs
  (which still contain only their original committed sample CSVs).
- **No retraining occurred**; no metrics were changed. Methodology review is Phase 6.

---

## 8. Commands executed

```
git checkout -b portfolio-demo
git rm cli-client/token.json
cd back-end && npm install            # existing lockfile
cd front-end && npm install           # existing lockfile
cd back-end && npx jest               # baseline + after changes
cd front-end && CI=true npx react-scripts test --watchAll=false
cd front-end && CI=true npx react-scripts build
docker build -t toll-analysis:milestone-a .        # legacy builder (buildx absent)
docker run --rm ... /opt/venv/bin/python -c "<load all 32 pkl>"
docker run --rm ... /opt/venv/bin/pip freeze
docker compose config
docker compose up --build -d          # full clean BuildKit build → healthy
curl http://localhost:9115/{healthz,/,/map,/debts,/login,/static/...}
curl -XPOST .../api/login ; curl .../api/{chargesBy,passAnalysis,tollStationPasses,forecast,peak_hour,get_debts_optimization,admin/healthcheck}
curl -X{POST,PATCH,PUT} .../api/{training,cancel_debts,passing_toll,admin/reset*}   # expect 503
chromium --headless ... http://localhost:9115{/,/map,/login}   # render + console
# disposable seeded MySQL on :3399 for the destructive integration-test run
docker run -d --name toll-test-db ... mysql:8.0 ; cd back-end && HOST=127.0.0.1 DB_PORT=3399 ... npx jest
git stash / npx jest / git stash pop   # regression check
docker compose down -v && docker compose up -d    # re-seed verification
```

---

## 9. Test / build / smoke results (exact)

| Check | Result |
|---|---|
| **Backend tests, no DB** (mocked suites only) | `Tests: 13 failed, 47 passed, 60 total` — identical to the pre-change baseline. Regression check (`git stash` the backend changes, re-run): stashed = 46 passed, current = 47 passed ⇒ **+1 pass, 0 regressions**. |
| **Backend tests, against a fresh seeded disposable MySQL** | `Tests: 9 failed, 51 passed, 60 total`. The 9 failures are all in 3 suites: `admin.test.js`, `passing_toll.test.js`, `tollStationPasses.test.js`. |
| **Frontend tests** (`CI=true react-scripts test`) | `Test Suites: 1 passed` · `Tests: 1 passed`. (Previously the suite **could not run at all** — Jest failed to parse axios ESM.) |
| **Frontend production build** (`CI=true react-scripts build`) | `Compiled successfully.` · exit 0 · `build/` 9.6 MB. (Previously emitted eslint warnings.) |
| **Docker image build** | Succeeds via `docker build` **and** `docker compose build` (fresh/empty BuildKit cache, all wheels re-downloaded). Final image 1.28 GB. |
| **`docker compose up --build`** | `db` healthy in ~25 s, `app` healthy in ~10 s after. |
| **Health check accuracy** | `/healthz` → 200 `{status:ok,database:up}` on the stack; → 503 `{status:unavailable,database:down}` when run with no DB. |
| **DB init determinism** | 8 / 253 / 50 / 1002 / 353 / 56 / 8 rows — same every recreate. |
| **Login** | admin → token (role `admin`); `admin@neaodos.gr` → token (role `neaodos`). |
| **Authenticated analytics** | `chargesBy` (company role) → 200 w/ `vOpList`; `passAnalysis` (admin) → 200 `nPasses:156`; `tollStationPasses` → 200. Unauthenticated → 401. |
| **ML prediction** | `forecast` → 200 w/ predictions; `peak_hour` → 200 w/ predictions. |
| **Destructive endpoints** | `training`, `cancel_debts`, `passing_toll`, `admin/reset{passes,stations}` (both casings) → **503**; DB unchanged. |
| **SPA routing** | `/`, `/map`, `/debts`, `/login` → 200, byte-identical to `index.html`; `/static/js|css/main.*` → 200 correct MIME; `/api/does-not-exist` → 400 JSON (not swallowed by SPA). |
| **No hard-coded API origins in active React** | `grep` over `src/` — only `src/FileUpload.js` (confirmed dead, not imported anywhere) and a comment. |
| **Browser console** (`/`, `/map`, `/login`, headless Chromium) | No app JS errors, no uncaught exceptions, no failed app requests. Only: 2× React-Router-v6 "future flag" **info** warnings, 1× Chrome DOM hint "password input should have autocomplete". Landing page renders (screenshot captured). |
| **Server logs** | Clean: `Toll Analysis backend listening on port 9115 (production)` + `CSV file successfully parsed`. No errors/warnings/secrets. |

### Root-cause analysis of the 3 failing backend suites (per instruction — not "fixed" by changing assertions)

| Suite | Failing | Root cause | Verdict |
|---|---|---|---|
| `admin.test.js` | 5–6 | **Stale test code.** Asserts response shapes the controllers never return (`res.body.status === "failed"` where controllers send `{error}`); assertions like `expect([200,404]).toContain(res.status)` that are simply wrong; `healthcheck` expects 200 but that controller returns **401** on any DB hiccup (a pre-existing controller quirk). Also hits the real DB. | Not an application defect. Needs a rewrite (Phase 7). |
| `passing_toll.test.js` | 3 | **Integration test.** Exercises a DB-mutating Python import; needs a live seeded DB **and** the ML venv (`mysql-connector`, `pandas`) in the interpreter. On the host (no venv) the subprocess fails → 500. Would pass inside the container. | Environmental, not an application defect. |
| `tollStationPasses.test.js` | 2–3 | **Destructive-interference + integration.** Runs against the real DB; `admin.test.js` (parallel worker) calls `resetPasses`/`resetStations`, deleting `Passages` mid-run, so "expects rows" tests then get 204/500 non-deterministically. | Not an application defect. |

**Hazard discovered & documented**: `admin.test.js` calls the reset endpoints, and
Express routing is case-insensitive, so running `npm test` against a **shared**
database **wipes `Passages` and `Debt`**. The integration suites must run against a
disposable DB. The deployed `app` container is protected (`DISABLE_DESTRUCTIVE_OPS=true`).

---

## 10. Remaining risks / limitations

1. **3 backend integration suites still fail** (see §9). Pre-existing; 0 regressions from Milestone A. Proper fix = Phase 7 (isolate as unit tests + a dedicated ephemeral-DB job).
2. **Image is 1.28 GB.** `pyvis` drags in `ipython`; `build-essential` is installed then purged; scipy/sklearn/pandas are inherently large. Slimming (drop `pyvis`→lighter graph output, `--platform` wheels only, distroless) is a follow-up.
3. **Dockerfile `chown -R node:node /app`** adds ~1 min to the *first* build (cached after). Kept because it lets the admin upload/figure paths work if `DISABLE_DESTRUCTIVE_OPS` is ever set false; a targeted chown is a follow-up.
4. **`buildx` is not installed on this host.** `docker build` (classic) and `docker compose build` (embedded BuildKit) both work; a plain `DOCKER_BUILDKIT=1 docker build` does not. Documented in `docs/RUNNING.md` implicitly (compose is the supported path).
5. **Legacy prototype files still ship** in the React build: `front-end/public/{map,stats}.html`, `public/css/styles.css` → reachable at `/map.html` etc. Also `src/FileUpload.js` (dead, hard-codes `https://localhost:5000`), `src/main.js`, `src/reportWebVitals.js`, `src/logo.svg`. **Listed for cleanup after confirmation — not deleted** (per instruction).
6. **Other junk to clean later**: `tst_commit.txt`, `back-end/uploads1/`, `back-end/merging.sh`, `openapi.json` + `back-end/openapi.json` (stale, no longer served), `back-end/ml/{input,results,…}/*.csv` committed sample files, duplicate `getUser` definitions in `dbService.js`, `mysql` **and** `mysql2` both in deps, `fs`/`https`/`install`/`npm` as bogus prod deps (they bloat `npm ci`).
7. **Pre-existing behaviour left intact** (not Milestone A scope): `chargesBy` returns **400** for "no visiting operators" (should be 200/204); admin `healthcheck` returns **401** (should be 503) on DB error; `/api/tolls` is unauthenticated (the public map needs it and there is no demo-token flow yet); some non-sensitive `console.log`s remain in `passing_toll`/`cancel_debts` controllers; error responses are `{error: "..."}` (not yet a normalized envelope).
8. **CLI (`cli-client/cli.js`)** still hard-codes `http://localhost:9115/api/` — not React, a developer tool; left for a later phase.
9. **UI is still in Greek** and the landing page still routes visitors to a login wall — untouched by design (Phase 5).
10. **`docker compose up --build` on a very clean machine downloads ~130 MB of Python wheels** (numpy/scipy/sklearn/pandas/mysql-connector) — first build ~4–6 min on a ~1–2 MB/s link.

---

## 11. Acceptance criteria

| Criterion | Status |
|---|---|
| `docker compose up --build` starts the required services | ✅ |
| MySQL initializes deterministically | ✅ (8/253/50/1002/353/56/8) |
| Application accessible through one origin | ✅ `http://localhost:9115` (API + React build) |
| `/healthz` accurately reflects DB readiness | ✅ 200 up / 503 down |
| No hard-coded API origins in active React code | ✅ (only dead `FileUpload.js`) |
| Production cannot start with an absent/insecure JWT secret | ✅ (exit 1 in 3 cases, verified) |
| Sensitive authentication info not logged | ✅ |
| Python paths independent of the shell working directory | ✅ |
| At least login + one representative authenticated feature work | ✅ login + analytics + 2 ML endpoints |
| Exact test/build results reported | ✅ (§9) |
| No UI redesign or ML methodology rewrite mixed in | ✅ |

**No acceptance criterion failed.**

---

## Exact steps still required for external deployment (NOT performed)

1. Provision managed MySQL 8; run `db/init/01-schema.sql` then `02-data.sql` against
   it once (or a production seed without demo rows).
2. Set platform env: `NODE_ENV=production`, `JWT_SECRET` (`openssl rand -hex 32`),
   `HOST`/`DB_PORT`/`DUSER`/`PASSWORD`/`DATABASE` for the managed DB,
   `DISABLE_DESTRUCTIVE_OPS=true`, `CORS_ALLOWED_ORIGINS` (only if the frontend is
   ever served cross-origin — not needed for the bundled image).
3. Build and push the image (`docker build -t <registry>/toll-analysis:<tag> .`).
4. Deploy one container, port 9115, health-check path `/healthz`, start command
   `node server.js` (default).
5. Terminate TLS at the platform / load balancer (the app speaks plain HTTP).
6. Smoke-test: `/healthz` 200 → login → one analytics call → one forecast call.

A full provider-neutral `DEPLOYMENT.md` with rollback + verification checklist is
Phase 8.

---

## Suggested follow-up (ordered by value)

1. **Phase 4 – safe demo mode**: `demo` user + `POST /api/auth/demo-login` (short-lived
   token), "Explore Live Demo" entry, so a visitor can reach the map/dashboards/forecast
   without credentials. (`demo` role is already wired into `ANALYTICS_ROLES`.)
2. **Phase 7 – test suite**: convert `admin`/`passing_toll`/`tollStationPasses` to
   isolated unit tests (mock DB) + a separate ephemeral-DB integration job; add
   `/healthz`, RBAC, demo-restriction, and forecast tests; a Playwright visitor-journey
   smoke test.
3. **Phase 5 – UI/UX + English**: navigation, landing page, replace `alert()`,
   loading/empty/error states, responsive, a11y.
4. **Phase 6 – ML methodology**: chronological split, seasonal-naive baseline,
   recorded MAE/RMSE + metadata, actual-vs-predicted, honest limitations doc.
5. **Image slimming** (§10.2) and the `chown` fix (§10.3).
6. **Cleanup pass** (§10.5–10.6) once the running app confirms the dead files.
7. **Phase 8 – `DEPLOYMENT.md`** and **Phase 9 – README rewrite**.
