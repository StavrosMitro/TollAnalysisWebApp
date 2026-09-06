/**
 * Centralised runtime configuration.
 *
 * Every environment variable the backend depends on is read here exactly once
 * so the rest of the code never touches `process.env` directly. This also gives
 * us a single place to fail fast on an insecure production configuration.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// --- JWT secret -------------------------------------------------------------
// A single canonical name: JWT_SECRET. (The codebase previously mixed
// SECRET_KEY and JWT_SECRET, both falling back to a public hard-coded value.)
const INSECURE_SECRETS = new Set([
  '',
  'mySuperSecretKey',
  'secret',
  'changeme',
  'change-me',
  'dev-secret',
]);

const DEV_JWT_FALLBACK = 'dev-only-insecure-jwt-secret-change-me-not-for-any-real-use';

// HMAC-SHA256 (HS256) keys should carry at least as much entropy as the hash
// output: 256 bits = 32 bytes. Generate with `openssl rand -hex 32` (64 chars).
const MIN_JWT_SECRET_BYTES = 32;

function looksLowEntropy(value) {
  // Cheap guard against obviously weak long strings (e.g. "aaaa...", "0000...").
  return /^(.)\1+$/.test(value) || /^(012|abc|password|secret)/i.test(value);
}

function resolveJwtSecret() {
  const provided = process.env.JWT_SECRET;

  if (isProduction) {
    const bytes = provided ? Buffer.byteLength(provided, 'utf8') : 0;
    if (
      !provided ||
      INSECURE_SECRETS.has(provided) ||
      bytes < MIN_JWT_SECRET_BYTES ||
      looksLowEntropy(provided)
    ) {
      // eslint-disable-next-line no-console
      console.error(
        '[config] FATAL: JWT_SECRET is missing, weak, or shorter than 32 bytes. ' +
          'Refusing to start in production. Generate one with: openssl rand -hex 32'
      );
      process.exit(1);
    }
    return provided;
  }

  if (!provided) {
    if (!isTest) {
      // eslint-disable-next-line no-console
      console.warn(
        '[config] JWT_SECRET not set - using an insecure development-only fallback. ' +
          'Set JWT_SECRET for any non-local use.'
      );
    }
    return DEV_JWT_FALLBACK;
  }
  return provided;
}

// --- CORS -----------------------------------------------------------------
// Comma-separated list of allowed origins for local / cross-origin development.
// In production the app is served same-origin, so the default is "no
// cross-origin access".
function resolveCorsOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return isProduction ? [] : ['http://localhost:3000'];
}

// --- Paths --------------------------------------------------------------
// Runtime-generated artefacts (prediction input/output CSVs, debt figures)
// must never be written into tracked source directories. RUNTIME_DIR is that
// writable location; it defaults to <repo>/back-end/var which is gitignored.
const runtimeDir = process.env.RUNTIME_DIR
  ? path.resolve(process.env.RUNTIME_DIR)
  : path.join(__dirname, 'var');

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[config] could not create runtime dir ${dir}: ${err.message}`);
  }
  return dir;
}

const config = {
  nodeEnv: NODE_ENV,
  isProduction,
  isTest,

  port: parseInt(process.env.PORT, 10) || 9115,

  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',

  // Public portfolio demo: a dedicated, fictional, read-only identity.
  // Short-lived token (default 90 min, clamped to 60-120 min).
  demo: {
    email: process.env.DEMO_USER_EMAIL || 'demo@toll-analysis.example',
    role: 'demo',
    tokenExpiresIn: (() => {
      const raw = parseInt(process.env.DEMO_TOKEN_TTL_MINUTES, 10);
      const minutes = Number.isFinite(raw) ? Math.min(120, Math.max(60, raw)) : 90;
      return `${minutes}m`;
    })(),
  },

  corsOrigins: resolveCorsOrigins(),

  db: {
    host: process.env.HOST || 'localhost',
    user: process.env.DUSER || 'root',
    password: process.env.PASSWORD || '',
    database: process.env.DATABASE || 'toll_analysis',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
  },

  // Absolute path to the Python interpreter that has the ML dependencies.
  pythonBin: process.env.PYTHON_BIN || 'python3',

  paths: {
    backendRoot: __dirname,
    mlDir: path.join(__dirname, 'ml'),
    modelsPassages: path.join(__dirname, 'models_passages'),
    modelsPeakHours: path.join(__dirname, 'models_peak_hours'),
    scriptsDir: path.join(__dirname, 'scripts'),
    debtFigures: path.join(__dirname, 'debt_figures'),
    runtimeDir: ensureDir(runtimeDir),
    clientBuild: process.env.CLIENT_BUILD_DIR
      ? path.resolve(process.env.CLIENT_BUILD_DIR)
      : path.join(__dirname, 'client'),
  },

};

// Feature flags - read live (as getters) so they can be toggled at runtime and
// in tests without reloading the module. `config` stays the only place that
// reads process.env.
Object.defineProperty(config, 'disableDestructiveOps', {
  enumerable: true,
  get() {
    return process.env.DISABLE_DESTRUCTIVE_OPS === 'true';
  },
});

// When true, a company-role user may only query their OWN operator's data on
// the operator-scoped analytics/forecast endpoints (admin + demo are
// unaffected). Default OFF - the current API treats the operator id purely as
// a selector and the sample dataset is shared. See docs/AUTHORIZATION.md.
Object.defineProperty(config, 'enforceCompanyScope', {
  enumerable: true,
  get() {
    return process.env.ENFORCE_COMPANY_SCOPE === 'true';
  },
});

module.exports = config;
