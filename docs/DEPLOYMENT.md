# Public portfolio deployment guide

This is a **platform-neutral runbook**, not a provider configuration. The
target topology is one small always-on application container and one managed
MySQL 8 database. Do not deploy the Compose file unchanged to a managed
platform: use the provider's database hostname, TLS material, and secret store
instead. A future zero-cost trial deployment can pair a Koyeb application with
an Aiven MySQL trial, but this repository does not create or deploy either
resource.

## Runtime contract

The public service listens on `0.0.0.0:$PORT` (`PORT` defaults to `9115`) behind
managed HTTPS. The React production bundle and Express API share that one
origin. The production database is external and uses the provider endpoint;
the Compose MySQL service is strictly a local-development convenience. The Node
process creates a short-lived Python process for each forecast/peak request.
Public demo mode permits one active inference at a time, a 20-second timeout by
default, and one BLAS/OpenMP thread per process.

Required deployment variables (put values in the provider's secret/config
store, never in Git):

| Variable | Public value / source | Secret |
| --- | --- | --- |
| `NODE_ENV` | `production` | no |
| `PORT` | platform-injected or `9115` | no |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER` | provider MySQL connection details (`DATABASE_PORT=3306` unless supplied otherwise) | no |
| `DATABASE_PASSWORD` | dedicated MySQL user password | **yes** |
| `DATABASE_CONNECTION_LIMIT` | `3` (bounded 1–10) | no |
| `DATABASE_CONNECT_TIMEOUT_MS` | `10000` (bounded 1000–60000) | no |
| `DATABASE_SSL` | `true` for managed MySQL TLS, otherwise exactly `false` | no |
| `DATABASE_SSL_CA_BASE64` | base64-encoded provider CA PEM, required when TLS is true | **yes** |
| `JWT_SECRET` | `openssl rand -hex 32` output | **yes** |
| `PUBLIC_DEMO_MODE` | `true` | no |
| `DISABLE_DESTRUCTIVE_OPS` | `true` (required with public mode) | no |
| `TRUST_PROXY` | `true` behind exactly one managed proxy | no |
| `DEMO_TOKEN_TTL_MINUTES` | `60`–`120`, default `90` | no |
| `INFERENCE_TIMEOUT_MS` | `1000`–`60000`, default `20000` | no |
| `INFERENCE_MAX_CONCURRENT` | `1`–`8`, default `1` in public demo mode | no |
| `CORS_ALLOWED_ORIGINS` | empty for this same-origin deployment | no |

Production refuses to start with a weak/missing `JWT_SECRET`, missing database
settings, invalid pool/timeout values, malformed/missing TLS CA data when TLS
is enabled, a known local DB password, or `PUBLIC_DEMO_MODE=true` without
destructive operations disabled. TLS CA data is decoded only in memory and
uses certificate verification (`rejectUnauthorized: true`). The legacy
`HOST`/`DB_PORT`/`DUSER`/`PASSWORD`/`DATABASE` names remain local Compose
fallbacks only; use the canonical `DATABASE_*` names for a hosted service.

## Database lifecycle

`db/init/*.sql` is Docker-entrypoint material, not a managed-provider import
interface. It contains `DROP`, root-definer, lock, and dump-optimisation
directives that make it unsuitable for direct managed deployment. Normal
application startup never creates, seeds, resets, drops, or overwrites data.

1. Create a private, persistent MySQL 8 database and a least-privileged
   application user. Take a provider snapshot before any import.
2. Run the read-only check from the release image or a configured release shell:

   ```bash
   cd back-end && npm run db:deploy-check
   ```

   It only reports whether the target is empty or compatible; it changes
   nothing and never prints credentials.
3. Against a verified empty fictional-demo database, perform the reviewed
   one-time seed explicitly:

   ```bash
   cd back-end
   CONFIRM_DB_DEPLOY=true npm run db:deploy-seed
   npm run db:status
   ```

   The seed command refuses any existing table, reads the reviewed repository
   SQL directly, strips Docker-only destructive/root/lock directives in memory,
   and does not put a password on a command line. It has no `drop`, `reset`, or
   automatic-startup path. A failure may leave partial DDL/data behind; restore
   from a provider snapshot or inspect the disposable target before retrying.
4. Use provider snapshots/backups and test restore only into a **separate**
   MySQL instance. A restart/redeploy only reconnects to the existing database;
   it never runs the bootstrap.

Use separate provider credentials where supported: the one-off importer needs
schema/data creation privileges for an empty target, while the long-running
application user needs only the normal application read/write privileges. Do
not grant either identity `DROP`, database-administration, or broad server
privileges for this demo.

## Checks and safety notes

* `GET /livez` is liveness (Node process only); `GET /healthz` is readiness and
  returns `503` with a non-sensitive body while MySQL is unavailable.
* The application uses one shared, bounded MySQL pool and closes it during a
  graceful shutdown. No request path creates a pool or embeds credentials in
  logs, health responses, or command arguments.
* The production filesystem is treated as ephemeral. Public-mode write paths
  (uploads, training, figures, and destructive mutation) are backend-blocked;
  the temporary runtime directory is under the OS temp directory. Persistent
  files must use an explicitly provisioned external store in a future feature.
* Set the app container to a small limit (for example 512 MB) and set alerting
  at roughly 80% memory/CPU. Keep MySQL capacity and backups on the managed
  service rather than co-locating it with this application container.
* In public mode `POST /api/login` is rejected before any user lookup. Only
  `POST /api/auth/demo-login` issues a short-lived `demo` token. All admin,
  bulk upload, training, reset and debt mutation routes remain backend-blocked.
* Logs are JSON request summaries in production and intentionally omit bodies,
  query strings, auth headers and tokens.
* `back-end/hashPassword.js` is excluded from runtime image layers. Historical
  fixture credentials remain a repository-history concern, not deployment
  credentials; public mode blocks them at the API boundary.

## Local constrained verification

Use a disposable MySQL container on a private Docker network (not the Compose
`db` service), seed it through the explicit command above, then run the app
with the provider-style `DATABASE_*` environment values. A representative
memory check is:

```bash
docker run --rm --memory=512m --memory-swap=512m --pids-limit=100 \
  -e NODE_ENV=production -e PUBLIC_DEMO_MODE=true \
  -e DISABLE_DESTRUCTIVE_OPS=true -e DATABASE_HOST=external-mysql \
  -e DATABASE_NAME=toll_analysis -e DATABASE_USER=... \
  -e DATABASE_PASSWORD=... toll-analysis:local
```

First assess functional memory behavior with a reasonable CPU allocation, then
repeat the latency measurement separately with `--cpus=0.1` and generous
request timeouts. CPU throttling is a capacity measurement, not a reason to
weaken the inference timeout or correctness contract.

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

## Future managed-service example

For a future trial, provision the app and database separately: a Koyeb app
service builds this Dockerfile and an Aiven MySQL service supplies the private
endpoint (or its public TLS endpoint where private networking is unavailable).
Set the canonical `DATABASE_*` variables in the app secret/config store,
including `DATABASE_SSL=true` and the base64 CA PEM. Do not set an internal
Compose host such as `db` on the provider. Configure `/livez` as the process
health probe and `/healthz` as the readiness probe, then run the explicit
database check/seed sequence from a one-off release shell. This is guidance
only: no cloud account, database, deployment, or billing resource is created
by this repository.
