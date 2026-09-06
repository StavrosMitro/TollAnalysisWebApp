#!/usr/bin/env bash
# `npm run test:integration`
#
# 1. starts a FRESH disposable MySQL (name ends in _test, own container)
# 2. runs the integration suite against it
# 3. always tears the database down afterwards
#
# Requires Docker. Set INTEGRATION_ML=true if PYTHON_BIN points at an
# interpreter that has scikit-learn (enables the forecast test).
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() { bash scripts/integration-db.sh down >/dev/null 2>&1 || true; }
trap cleanup EXIT

bash scripts/integration-db.sh up

# Load the connection env vars produced by integration-db.sh into this shell.
set -a
# shellcheck source=/dev/null
source <(bash scripts/integration-db.sh env)
set +a

echo "[run-integration] DATABASE=$DATABASE HOST=$HOST DB_PORT=$DB_PORT"

npx jest --config jest.integration.config.js --forceExit "$@"
