/**
 * Loaded before any integration-test module.
 *
 * Integration tests run destructive SQL (resets, bulk imports) against a REAL
 * MySQL. To make it impossible to point them at a developer or demo database,
 * this file fails fast unless ALL of the following are true:
 *
 *   NODE_ENV=test
 *   DATABASE name ends in "_test"
 *   ALLOW_DESTRUCTIVE_TESTS=true
 *
 * Provide a disposable database with:  back-end/scripts/integration-db.sh up
 */
const REQUIRED_DB_SUFFIX = '_test';

function fail(msg) {
  // eslint-disable-next-line no-console
  console.error(`\n[integration setup] REFUSING TO RUN: ${msg}\n`);
  process.exit(1);
}

if (process.env.NODE_ENV !== 'test') {
  fail('NODE_ENV must be "test".');
}
if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
  fail('ALLOW_DESTRUCTIVE_TESTS must be "true" (opt-in for DB-mutating tests).');
}
const db = process.env.DATABASE || '';
if (!db.endsWith(REQUIRED_DB_SUFFIX)) {
  fail(`DATABASE ("${db}") must end in "${REQUIRED_DB_SUFFIX}".`);
}

// The integration DB must never be the compose/demo database.
if (['toll_analysis'].includes(db)) {
  fail(`DATABASE "${db}" is a known non-test database.`);
}

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'integration-test-jwt-secret-not-for-production-0123';
process.env.RUNTIME_DIR =
  process.env.RUNTIME_DIR || require('os').tmpdir() + '/toll-analysis-integration-test';
// Integration tests exercise the real destructive endpoints, so the switch
// must be OFF here.
process.env.DISABLE_DESTRUCTIVE_OPS = 'false';
