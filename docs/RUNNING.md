# Running the application locally

## Option A - Docker (recommended)

Requires Docker with the Compose plugin.

```bash
git clone <this-repo>
cd TollAnalysisWebApp
docker compose up --build
```

This starts:

| Service | Purpose | Notes |
|---------|---------|-------|
| `db`    | MySQL 8 | Initialised once from `db/init/*.sql` onto a named volume (`db_data`). |
| `app`   | Node/Express API **+** the React production build | Single origin. |

When the `app` health check turns healthy, open:

- **App:** <http://localhost:9115>
- **Health:** <http://localhost:9115/healthz>
- **API docs:** <http://localhost:9115/api/docs>

### Configuration

The stack runs with built-in local defaults. To override, copy `.env.example`
to `.env` (same directory as `docker-compose.yml`) and edit it. The most
important variable is `JWT_SECRET` - it must be at least 16 characters and not
a known-weak value, or the backend refuses to start.

### Seeded login accounts

Created by `db/init/02-data.sql`:

| Email | Password | Role |
|-------|----------|------|
| `admin@yme.gov.gr` | `yme123!` | `admin` |
| `admin@aodos.gr` | `Aodos123!` | `aodos` |
| `admin@gefyra.gr` | `Gefyra123!` | `gefyra` |
| `admin@egnatia.eu` | `Egnatia123!` | `egnatia` |
| `admin@kentrikiodos.gr` | `Kentriki123!` | `kentrikiodos` |
| `admin@moreas.com.gr` | `Moreas123!` | `moreas` |
| `admin@neaodos.gr` | `Neaodos123!` | `neaodos` |
| `admin@olympiaodos.gr` | `Olympia123!` | `olympiaodos` |

These are sample educational credentials for a demo dataset - not real accounts.

### Resetting the database

```bash
docker compose down -v      # removes the db_data volume
docker compose up --build   # re-runs db/init on a fresh volume
```

### Optional: database browser

```bash
docker compose --profile tools up   # adds Adminer on http://localhost:8081
```

---

## Option B - Run services directly on the host

Requires Node 20, Python 3.11, and a local MySQL 8.

### 1. Database

```bash
mysql -u root -p -e "CREATE DATABASE toll_analysis"
mysql -u root -p toll_analysis < db/init/01-schema.sql
mysql -u root -p toll_analysis < db/init/02-data.sql
```

### 2. Backend

```bash
cd back-end
cp .env.example .env          # then edit DB credentials + JWT_SECRET
npm install
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
PYTHON_BIN=./.venv/bin/python node server.js   # or set PYTHON_BIN in .env
```

Backend: <http://localhost:9115>

### 3. Frontend (dev server with hot reload)

```bash
cd front-end
cp .env.example .env          # REACT_APP_API_BASE_URL=http://localhost:9115/api
npm install
npm start
```

Frontend dev server: <http://localhost:3000> (proxies API calls to :9115).

---

## Public demo

No credentials needed - the landing page has an **"Explore Live Demo"** button.
It calls `POST /api/auth/demo-login`, which issues a short-lived (~90 min),
read-only `demo` token for the seeded fictional identity
`demo@toll-analysis.example`. Demo users can browse the map, analytics and
forecasts; every write / admin / training operation is denied. See
`docs/AUTHORIZATION.md`.

## Tests

| Command | What it runs | Needs |
|---|---|---|
| `cd back-end && npm test` | Backend **unit** tests (`jest.unit.config.js`). DB, Python and filesystem are mocked. | Node only |
| `cd back-end && npm run test:unit` | same as `npm test` | Node only |
| `cd back-end && npm run test:integration` | Spins a **fresh disposable MySQL** (`toll_analysis_test`, own container), runs `testing/integration/*` against the real app, tears the DB down afterwards. Refuses to run unless `NODE_ENV=test`, `DATABASE` ends `_test`, `ALLOW_DESTRUCTIVE_TESTS=true` (the wrapper sets these). | Docker |
| `cd front-end && CI=true npm test` | Frontend tests | Node only |
| `cd front-end && npm run build` | Frontend production build | Node only |

`INTEGRATION_ML=true npm run test:integration` also runs the forecast test (needs
`PYTHON_BIN` pointing at an interpreter with scikit-learn).
