#!/usr/bin/env bash
# Disposable MySQL for `npm run test:integration`.
#
#   bash scripts/integration-db.sh up      # start + wait + seed
#   bash scripts/integration-db.sh down     # remove
#   bash scripts/integration-db.sh env      # print the env vars to export
#
# The database is named toll_analysis_TEST and lives in a throwaway container -
# it can never collide with the compose/demo database.
set -euo pipefail

NAME="toll-analysis-integration-db"
DB="toll_analysis_test"
ROOT_PW="integration_test_only"
PORT="${INTEGRATION_DB_PORT:-3399}"
INIT_DIR="$(cd "$(dirname "$0")/../../db/init" && pwd)"

case "${1:-up}" in
  up)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" \
      -e MYSQL_ROOT_PASSWORD="$ROOT_PW" \
      -e MYSQL_DATABASE="$DB" \
      -p "${PORT}:3306" \
      -v "${INIT_DIR}:/docker-entrypoint-initdb.d:ro" \
      mysql:8.0 >/dev/null
    echo "waiting for $DB ..."
    seeded=0
    for _ in $(seq 1 60); do
      if docker exec "$NAME" mysql -uroot -p"$ROOT_PW" "$DB" \
           -e "SELECT COUNT(*) FROM Passages" >/dev/null 2>&1; then
        seeded=1
        break
      fi
      sleep 2
    done
    if [ "$seeded" -ne 1 ]; then
      echo "timed out waiting for MySQL" >&2
      docker logs "$NAME" | tail -20 >&2
      exit 1
    fi
    # MySQL is ready on its internal socket; wait for the host port proxy too.
    for _ in $(seq 1 30); do
      if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
        exec 3>&- 3<&-
        echo "ready. export:"
        "$0" env
        exit 0
      fi
      sleep 1
    done
    echo "MySQL up but host port ${PORT} not reachable" >&2
    exit 1
    ;;
  down)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    echo "removed $NAME"
    ;;
  env)
    cat <<EOF
export NODE_ENV=test
export ALLOW_DESTRUCTIVE_TESTS=true
export DATABASE=$DB
export HOST=127.0.0.1
export DB_PORT=$PORT
export DUSER=root
export PASSWORD=$ROOT_PW
EOF
    ;;
  *)
    echo "usage: $0 {up|down|env}" >&2
    exit 2
    ;;
esac
