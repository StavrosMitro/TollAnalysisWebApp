// Runs before any test module is loaded. Guarantees the central config
// module resolves a deterministic (non-production) JWT secret so tests that
// sign their own tokens stay in sync with the middleware.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';
process.env.RUNTIME_DIR = process.env.RUNTIME_DIR || require('os').tmpdir() + '/toll-analysis-test';
