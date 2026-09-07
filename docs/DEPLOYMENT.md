# Public portfolio deployment guide

This is a **platform-neutral runbook**, not a provider configuration. It is
deliberately written for one small always-on application container and one
private MySQL 8 service/volume. Do not deploy the compose file unchanged to a
managed platform: use the provider's private database hostname and its secrets
store instead.

## Runtime contract

The public service exposes only `PORT` (default `9115`) over managed HTTPS. The
React production bundle and Express API share that one origin. MySQL listens
only on the private service network at `3306`; the local compose setup no
longer publishes it to the host. The Node process creates a short-lived Python
process for each forecast/peak request, with at most two active processes and a
20-second timeout by default.

Required deployment variables (put values in the provider's secret/config
store, never in Git):

| Variable | Public value / source | Secret |
| --- | --- | --- |
| `NODE_ENV` | `production` | no |
| `PORT` | platform-injected or `9115` | no |
| `HOST`, `DB_PORT`, `DUSER`, `DATABASE` | private MySQL connection details | no |
| `PASSWORD` | dedicated MySQL user password | **yes** |
| `JWT_SECRET` | `openssl rand -hex 32` output | **yes** |
| `PUBLIC_DEMO_MODE` | `true` | no |
| `DISABLE_DESTRUCTIVE_OPS` | `true` (required with public mode) | no |
| `TRUST_PROXY` | `true` behind exactly one managed proxy | no |
| `DEMO_TOKEN_TTL_MINUTES` | `60`–`120`, default `90` | no |
| `INFERENCE_TIMEOUT_MS` | `1000`–`60000`, default `20000` | no |
| `INFERENCE_MAX_CONCURRENT` | `1`–`8`, default `2` | no |
| `CORS_ALLOWED_ORIGINS` | empty for this same-origin deployment | no |

Production refuses to start with a weak/missing `JWT_SECRET`, a known local DB
password, or `PUBLIC_DEMO_MODE=true` without destructive operations disabled.
`ALLOW_INSECURE_LOCAL_DEFAULTS=true` exists only in the checked-in local Compose
configuration so its throwaway defaults remain convenient; do not set it on a
hosted deployment.

## Database lifecycle

`db/init/*.sql` is MySQL image initialization material: it runs **only for an
empty MySQL data volume**. Normal application startup never runs SQL that
creates, seeds, resets, or overwrites a database.

1. Create a private, persistent MySQL 8 database and a least-privileged
   application user. Take a provider snapshot before importing anything.
2. Against a verified empty fictional-demo database, import in order:

   ```bash
   mysql --host "$HOST" --port "$DB_PORT" --user "$DUSER" --password "$DATABASE" < db/init/01-schema.sql
   mysql --host "$HOST" --port "$DB_PORT" --user "$DUSER" --password "$DATABASE" < db/init/02-data.sql
   mysql --host "$HOST" --port "$DB_PORT" --user "$DUSER" --password "$DATABASE" < db/init/03-demo-account.sql
   ```

   These are a reviewed, one-time fictional seed operation—not application
   startup commands. The scripts are not a general migration framework.
3. Run the read-only preflight in an app image or equivalent release shell:

   ```bash
   cd back-end && npm run db:status
   ```

   It verifies the expected table set, the demo identity and seed passage
   count; it does not change data. A restart/redeploy only reconnects to the
   existing database.
4. Use provider snapshots/backups and test restore into a **separate** MySQL
   instance. A portable logical backup is:

   ```bash
   mysqldump --single-transaction --routines --host "$HOST" --port "$DB_PORT" --user "$DUSER" --password "$DATABASE" > toll-analysis-demo.sql
   ```

   Restore only after creating a separate target database. Never point a reset
   or import command at the live database. To reset the fictional dataset, stop
   the app, snapshot/export it, drop **only the confirmed demo database**, then
   repeat the explicit three imports above. This is intentionally manual.

## Checks and safety notes

* `GET /livez` is liveness (Node process only); `GET /healthz` is readiness and
  returns `503` with a non-sensitive body while MySQL is unavailable.
* In public mode `POST /api/login` is rejected before any user lookup. Only
  `POST /api/auth/demo-login` issues a short-lived `demo` token. All admin,
  bulk upload, training, reset and debt mutation routes remain backend-blocked.
* Logs are JSON request summaries in production and intentionally omit bodies,
  query strings, auth headers and tokens.
* `back-end/hashPassword.js` is excluded from runtime image layers. Historical
  fixture credentials remain a repository-history concern, not deployment
  credentials; public mode blocks them at the API boundary.

## PyVis and CSP

The approved before/after PyVis graphs remain generated HTML in a sandboxed
`srcDoc` iframe (`sandbox="allow-scripts"`, no same-origin access). Each graph
uses inline generated JavaScript plus pinned `vis-network` from cdnjs and
Bootstrap assets from jsDelivr. The app's CSP therefore allows only those two
CDN origins plus `'unsafe-inline'` for script/style; removing either allowance
breaks the interactive graph. See `TECH_DEBT.md` for the accepted limitation.

## Dependency-audit triage (reviewed September 2026)

No automatic audit fix was applied. `npm audit --omit=dev` reports 33 backend
findings (1 critical, 23 high) and 64 frontend findings (3 critical, 32 high).
The counts overstate deployed exposure because the frontend's build toolchain is
not copied into the runtime image; only its compiled static assets are served.

| Package / advisory family | Severity | Deployed reachability | Recommended action |
| --- | --- | --- | --- |
| `mysql2` — clear-password auth downgrade and compressed-protocol inflate | high / moderate | **Yes:** the API opens MySQL connections, although the DB is private and provider-controlled. | Upgrade to the latest compatible `mysql2` 3.x, verify TLS/auth settings and run integration tests. |
| `express` via `path-to-regexp`, `qs`, `body-parser` — route/query/body DoS | high / moderate | **Yes:** Express parses public requests; body limits reduce but do not remove the risk. | Perform a reviewed compatible Express 4.x lockfile update and rerun all API tests. |
| `jsonwebtoken` → `jws` signature verification | high | **Yes:** JWT verification is on every protected request. | Update the resolved `jws` through a compatible `jsonwebtoken` release, then repeat auth regression tests. |
| `bcrypt` → `node-pre-gyp` → `tar` | high / critical | The vulnerable archive code is install/build-time; bcrypt password hashing itself is used only by operator login/admin flows. | Plan a reviewed `bcrypt` 6 migration (or consolidate on the existing `bcryptjs`), not an automatic major upgrade. |
| `express-validator` → `validator` | moderate / high | Potentially reachable only where validation helpers are used; no public user-supplied URL validation path was identified in this review. | Update after the Express work and add route-specific tests. |
| direct `npm` and its `tar`/`pacote`/`glob` tree | critical / high | Present in the runtime image because it is declared as an app dependency, but not invoked by request handling. | Remove the unnecessary direct `npm` dependency in a dedicated dependency-maintenance change; Node's bundled npm is sufficient for image builds. |
| `react-router-dom` → `@remix-run/router` open redirects | high | **Yes:** browser-shipped routing code; this app's routes are fixed rather than user-controlled redirect targets. | Upgrade React Router in a focused UI compatibility change and add redirect/path tests. |
| `react-scripts` / webpack / SVGO / Jest / dev-server chain | critical / high through transitive packages | **No at runtime:** used to create the React bundle and absent from the final Node image. | Replace the unmaintained CRA toolchain in a separately scoped migration; keep CI/build environments patched in the meantime. |

The direct, request-path findings (`mysql2`, Express and JWT dependencies) are
tracked deployment risks, but this review found no exploit path in the current
public-demo configuration. Address them before treating the portfolio instance
as a generally exposed production service.

## Provider choice, checked September 2026

**Recommendation: Railway Hobby.** It is the most direct fit: one custom
Dockerfile service, a private MySQL service with persistent volume, HTTPS and
custom domains, environment secrets, restart/health-check support, logs and
built-in volume/database backups. Its Hobby minimum is **$5/month**, including
the first $5 of usage; resource pricing is $10/GB-month RAM, $20/vCPU-month and
$0.15/GB-month volume storage. A continuously running 512 MB app plus a small
MySQL service will likely exceed the included credit; budget roughly
**$10–$25/month plus $0.05/GB egress**, then set a hard usage limit. A payment
card is required after the one-time trial. Cold starts are avoided while kept
running, but an explicit usage hard limit can stop services.

**Fallback: Render Hobby with a self-managed MySQL service and persistent
disk.** Render supports Docker web services, HTTPS/custom domains, secrets,
logs and restarts, but its managed relational product is Postgres; MySQL is a
custom database service on a paid persistent disk. That means the smallest
realistic topology is a 512 MB paid web service plus a separate paid MySQL
container/disk—typically about **$14–$20/month before disk and bandwidth**,
with more operational responsibility for MySQL backups. Render's free web
service has cold starts and free Postgres expires after 30 days, so neither is
appropriate for a reliable MySQL-backed public demo.

Fly.io was not selected: its managed database offering is Postgres and a MySQL
deployment would be self-operated on a volume, with more VM/networking work for
this portfolio scope. Its $0.15/GB-month volume and snapshot charges can also
continue while Machines are stopped.

Current official sources: [Railway pricing](https://docs.railway.com/pricing),
[Railway MySQL](https://docs.railway.com/databases/mysql), [Render pricing and
Docker support](https://render.com/pricing), [Render datastore policy](https://render.com/docs/faq),
[Render free-tier limitations](https://render.com/docs/free), and [Fly resource
pricing](https://fly.io/docs/about/pricing/).
