// Loaded before any unit-test module. Guarantees the central config module
// resolves a deterministic non-production JWT secret so tests that sign their
// own tokens stay in sync with the middleware, and forces all filesystem
// output into a temp dir.
//
// Unit tests must NEVER touch a real database - `dbService` / `child_process` /
// `fs` are mocked per suite.
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'unit-test-jwt-secret-not-for-production-0123456789';
process.env.RUNTIME_DIR =
  process.env.RUNTIME_DIR || path.join(os.tmpdir(), 'toll-analysis-unit-test');
// Belt-and-braces: a unit test that forgets to mock the DB should fail loudly,
// not connect somewhere real.
process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.DATABASE = process.env.DATABASE || 'toll_analysis_unit_should_be_mocked';
