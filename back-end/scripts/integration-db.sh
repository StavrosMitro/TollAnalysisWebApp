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
    # -fv: also drop the container's anonymous /var/lib/mysql volume. The mysql
    # image declares VOLUME on that path, so without -v every run leaks a
    # ~210 MB volume that nothing ever reclaims.
    docker rm -fv "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" \
      -e MYSQL_ROOT_PASSWORD="$ROOT_PW" \
      -e MYSQL_DATABASE="$DB" \
      -p "${PORT}:3306" \
      -v "${INIT_DIR}:/docker-entrypoint-initdb.d:ro" \
      mysql:8.0 >/dev/null
    echo "waiting for $DB (running schema + seed) ..."
    # The mysql image runs a TEMPORARY server to execute the init scripts, then
    # shuts it down and starts the real one. We must wait for the entrypoint's
    # "ready for start up" marker AND then for the real server + a query to
    # succeed over the host port - otherwise tests connect to a dying server.
    ready=0
    for _ in $(seq 1 90); do
      if docker logs "$NAME" 2>&1 | grep -q "MySQL init process done. Ready for start up." \
         && docker exec "$NAME" mysqladmin ping -uroot -p"$ROOT_PW" --silent >/dev/null 2>&1 \
         && docker exec "$NAME" mysql -uroot -p"$ROOT_PW" "$DB" -e "SELECT COUNT(*) FROM Passages" >/dev/null 2>&1; then
        ready=1
        break
      fi
      sleep 2
    done
    if [ "$ready" -ne 1 ]; then
      echo "timed out waiting for MySQL" >&2
      docker logs "$NAME" 2>&1 | tail -20 >&2
      exit 1
    fi
    # Now confirm the host port proxy answers a real query.
    for _ in $(seq 1 30); do
      if node -e "require('mysql2/promise').createConnection({host:'127.0.0.1',port:${PORT},user:'root',password:'${ROOT_PW}',database:'${DB}'}).then(c=>c.query('SELECT 1').then(()=>c.end())).then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
        echo "ready. export:"
        "$0" env
        exit 0
      fi
      sleep 1
    done
    echo "MySQL up but host port ${PORT} not usable" >&2
    exit 1
    ;;
  down)
    docker rm -fv "$NAME" >/dev/null 2>&1 || true
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
