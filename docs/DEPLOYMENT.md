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
Bootstrap assets from jsDelivr. The app's CSP therefore allows those two CDN
origins, the OpenStreetMap tile host, plus `'unsafe-inline'` for script/style;
removing either CDN allowance
breaks the interactive graph. See `TECH_DEBT.md` for the accepted limitation.

## Dependency-audit triage (Milestone F, reviewed September 2026)

The focused remediation used separate JSON audits for backend production
dependencies, the complete backend tree, frontend browser/runtime dependencies,
and frontend build/test tooling. No `npm audit fix --force` was used. Before
the changes, the backend production audit reported 33 findings (1 critical, 23
high); the frontend runtime-shaped audit reported 64 findings (3 critical, 32
high). After the changes, the backend production audit reports 10 findings (1
critical, 6 high) and the frontend audit reports 63 findings (3 critical, 29
high). Those totals are not exposure totals: the frontend manifest still uses
Create React App packages to build the bundle, but the final image contains
only the compiled frontend assets and the backend production dependencies.

Intentional direct changes:

* `mysql2` `^3.11.3` -> `^3.24.3`, resolving the direct auth-downgrade
   advisory GHSA-3f6p-5ww8-9rcr and the compressed-protocol advisory.
* Removed the unused direct `npm` dependency. Its `pacote`, `tar`, `glob`, and
   `minimatch` tree was never imported by request-path code and is absent from
   the runtime dependency tree.
* Added compatible npm overrides for `jws` `3.2.3` and `validator` `13.15.35`.
   `jws` is used by `jsonwebtoken` request authentication; `validator` is used
   by `express-validator` and the override stays within the package API.
* Added a scoped Express override for `path-to-regexp` `0.1.13`, the patched
   version compatible with the existing Express 4 route matcher.
* `react-router-dom` `^6.28.0` -> `^6.30.6`, clearing the browser-shipped
   React Router redirect advisories without changing the major version.

Remaining critical/high findings and disposition:

| Finding / path | Installed / patched | Reachability and disposition |
| --- | --- | --- |
| `tar` advisories `1112659`, `1113300`, `1113375`, `1114200`, `1114302`, `1114680`, `1120782`, `1123939`, `1123940`, `1123941`, `1123942`, `1145647` via `bcrypt` -> `@mapbox/node-pre-gyp` -> `tar@6.2.1` | `tar@6.2.1`; patched releases are `7.5.x` | Install/build-time archive extraction only. No request handler imports `tar`; accepted temporarily while avoiding a risky bcrypt major migration. The final image retains bcrypt for operator password hashing, but not an application archive-extraction path. |
| `@mapbox/node-pre-gyp` advisories via `bcrypt` | `@mapbox/node-pre-gyp@1.0.11`; no compatible direct patch selected | Install-time native-module packaging path, not request-time code. Same bcrypt disposition as above. |
| GHSA-37ch-88jc-xwx in `express` -> `path-to-regexp@0.1.12` | Resolved to patched `path-to-regexp@0.1.13` through a scoped npm override | Reachable Express route parsing is now on the patched legacy-compatible release; backend unit and integration tests passed after the override. |
| js-yaml advisories via `swagger-jsdoc` -> `swagger-parser` -> `@apidevtools/json-schema-ref-parser` | `js-yaml@4.1.0`; current advisory fix is outside the selected compatible parser chain | Swagger documents are repository-controlled and generated at startup; no user-supplied YAML reaches this path. Vulnerable function is unreachable from public request handling. |
| lodash advisories via `express-validator` | `lodash@4.17.21`; patched release is outside this dependency's current range | The affected template/prototype helpers are not called by application validation routes. Validator was updated; lodash remains a separately planned express-validator compatibility update. |
| minimatch/brace-expansion advisories through dev utilities | `minimatch@3.1.2`, `brace-expansion@1.1.11` | Test/development tooling only (`jest`, `nodemon`, glob helpers); not in the backend production tree after removing `npm`. |

The browser-shipped React Router path has no remaining critical/high finding in
the final runtime audit. The remaining frontend critical/high findings belong
to CRA/Webpack/SVGO/PostCSS/Jest/Puppeteer build or test chains. They are absent
from the final runtime image and are not emitted into the browser bundle. A
compatible fix would require the explicitly out-of-scope CRA migration or a
separate reviewed toolchain update.

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
