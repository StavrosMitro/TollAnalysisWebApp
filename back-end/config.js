/**
 * Centralised runtime configuration.
 *
 * Every environment variable the backend depends on is read here exactly once.
 * Provider-neutral DATABASE_* names are canonical; the older local HOST,
 * DB_PORT, DUSER, PASSWORD and DATABASE names remain compatibility fallbacks.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';
const requestedPublicDemoMode = process.env.PUBLIC_DEMO_MODE === 'true';

const INSECURE_SECRETS = new Set([
  '', 'mySuperSecretKey', 'secret', 'changeme', 'change-me', 'dev-secret',
  'fb3afa47072220b5dc1798863721abb11e1c6272afe911376655a2363f4b6eaa',
]);
const INSECURE_DB_PASSWORDS = new Set(['', 'toll_app_local_only', 'root_local_only']);
const DEV_JWT_FALLBACK = crypto.randomBytes(32).toString('hex');
const MIN_JWT_SECRET_BYTES = 32;

function fatal(message) {
  // Keep configuration failures useful without ever echoing connection values.
  // eslint-disable-next-line no-console
  console.error(`[config] FATAL: ${message}`);
  process.exit(1);
}

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

function looksLowEntropy(value) {
  return /^(.)\1+$/.test(value) || /^(012|abc|password|secret)/i.test(value);
}

function resolveJwtSecret() {
  const provided = process.env.JWT_SECRET;
  if (isProduction) {
    const bytes = provided ? Buffer.byteLength(provided, 'utf8') : 0;
    // The checked-in Compose stack explicitly opts into its throwaway local
    // default. A public demo can never use that escape hatch.
    const allowLocalComposeDefault = process.env.ALLOW_INSECURE_LOCAL_DEFAULTS === 'true' && !requestedPublicDemoMode;
    if ((!provided || INSECURE_SECRETS.has(provided) || bytes < MIN_JWT_SECRET_BYTES || looksLowEntropy(provided)) && !allowLocalComposeDefault) {
      fatal('JWT_SECRET is missing, weak, or shorter than 32 bytes. Refusing to start in production.');
    }
    return provided;
  }
  if (!provided) {
    if (!isTest) {
      // eslint-disable-next-line no-console
      console.warn('[config] JWT_SECRET not set; using an insecure development-only fallback.');
    }
    return DEV_JWT_FALLBACK;
  }
  return provided;
}

function parseBoundedInteger(name, raw, fallback, min, max) {
  if (raw === undefined || raw === '') return fallback;
  if (!/^[0-9]+$/.test(raw)) fatal(`${name} must be an integer between ${min} and ${max}.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fatal(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function parseDatabaseSsl() {
  const raw = process.env.DATABASE_SSL;
  if (raw === undefined || raw === '' || raw === 'false') return false;
  if (raw !== 'true') fatal('DATABASE_SSL must be exactly true or false.');
  return true;
}

function decodeTlsCa() {
  const raw = process.env.DATABASE_SSL_CA_BASE64;
  if (!raw) fatal('DATABASE_SSL=true requires DATABASE_SSL_CA_BASE64.');
  // Buffer.from is permissive, so reject malformed base64 before decoding.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 !== 0) {
    fatal('DATABASE_SSL_CA_BASE64 is not valid base64 PEM data.');
  }
  const pem = Buffer.from(raw, 'base64').toString('utf8');
  if (!/^-----BEGIN CERTIFICATE-----[\r\n]+[\s\S]+-----END CERTIFICATE-----\s*$/.test(pem)) {
    fatal('DATABASE_SSL_CA_BASE64 does not contain a valid PEM certificate.');
  }
  return pem;
}

function resolveCorsOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (raw && raw.trim()) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return isProduction ? [] : ['http://localhost:3000'];
}

function ensureRuntimeDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (err) {
    if (isProduction) fatal('Could not create the configured temporary runtime directory.');
    // eslint-disable-next-line no-console
    console.warn(`[config] could not create runtime dir ${dir}: ${err.message}`);
    return dir;
  }
}

const dbSslEnabled = parseDatabaseSsl();
const db = {
  host: firstEnv('DATABASE_HOST', 'HOST') || (isProduction ? undefined : 'localhost'),
  port: parseBoundedInteger('DATABASE_PORT', firstEnv('DATABASE_PORT', 'DB_PORT'), 3306, 1, 65535),
  user: firstEnv('DATABASE_USER', 'DUSER') || (isProduction ? undefined : 'root'),
  password: firstEnv('DATABASE_PASSWORD', 'PASSWORD') || '',
  database: firstEnv('DATABASE_NAME', 'DATABASE') || (isProduction ? undefined : 'toll_analysis'),
  connectionLimit: parseBoundedInteger('DATABASE_CONNECTION_LIMIT', process.env.DATABASE_CONNECTION_LIMIT, 3, 1, 10),
  connectTimeout: parseBoundedInteger('DATABASE_CONNECT_TIMEOUT_MS', process.env.DATABASE_CONNECT_TIMEOUT_MS, 10000, 1000, 60000),
};

if (dbSslEnabled) db.ssl = { ca: decodeTlsCa(), rejectUnauthorized: true };
if (isProduction && (!db.host || !db.user || !db.database || !db.password)) {
  fatal('Required database configuration is missing.');
}
if (isProduction && INSECURE_DB_PASSWORDS.has(db.password) && process.env.ALLOW_INSECURE_LOCAL_DEFAULTS !== 'true') {
  fatal('DATABASE_PASSWORD must be supplied at runtime and must not use a local default.');
}

const runtimeDir = process.env.RUNTIME_DIR
  ? path.resolve(process.env.RUNTIME_DIR)
  : isProduction
    ? path.join(os.tmpdir(), 'toll-analysis-runtime')
    : path.join(__dirname, 'var');

const config = {
  nodeEnv: NODE_ENV,
  isProduction,
  isTest,
  port: parseBoundedInteger('PORT', process.env.PORT, 9115, 1, 65535),
  bindHost: '0.0.0.0',
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  demo: {
    email: process.env.DEMO_USER_EMAIL || 'demo@toll-analysis.example',
    role: 'demo',
    tokenExpiresIn: `${parseBoundedInteger('DEMO_TOKEN_TTL_MINUTES', process.env.DEMO_TOKEN_TTL_MINUTES, 90, 60, 120)}m`,
  },
  corsOrigins: resolveCorsOrigins(),
  trustProxy: process.env.TRUST_PROXY === 'true' || (isProduction && process.env.TRUST_PROXY !== 'false'),
  inference: {
    timeoutMs: parseBoundedInteger('INFERENCE_TIMEOUT_MS', process.env.INFERENCE_TIMEOUT_MS, 20000, 1000, 60000),
    maxConcurrent: parseBoundedInteger(
      'INFERENCE_MAX_CONCURRENT', process.env.INFERENCE_MAX_CONCURRENT,
      requestedPublicDemoMode ? 1 : 2, 1, 8
    ),
    threadEnv: {
      OMP_NUM_THREADS: requestedPublicDemoMode ? '1' : (process.env.OMP_NUM_THREADS || '1'),
      OPENBLAS_NUM_THREADS: requestedPublicDemoMode ? '1' : (process.env.OPENBLAS_NUM_THREADS || '1'),
      MKL_NUM_THREADS: requestedPublicDemoMode ? '1' : (process.env.MKL_NUM_THREADS || '1'),
      NUMEXPR_NUM_THREADS: requestedPublicDemoMode ? '1' : (process.env.NUMEXPR_NUM_THREADS || '1'),
    },
  },
  db,
  pythonBin: process.env.PYTHON_BIN || 'python3',
  paths: {
    backendRoot: __dirname,
    mlDir: path.join(__dirname, 'ml'),
    modelsPassages: path.join(__dirname, 'models_passages'),
    modelsPeakHours: path.join(__dirname, 'models_peak_hours'),
    scriptsDir: path.join(__dirname, 'scripts'),
    debtFigures: path.join(__dirname, 'debt_figures'),
    runtimeDir: ensureRuntimeDir(runtimeDir),
    clientBuild: process.env.CLIENT_BUILD_DIR ? path.resolve(process.env.CLIENT_BUILD_DIR) : path.join(__dirname, 'client'),
  },
};

Object.defineProperty(config, 'disableDestructiveOps', {
  enumerable: true,
  get() { return process.env.DISABLE_DESTRUCTIVE_OPS === 'true'; },
});
Object.defineProperty(config, 'publicDemoMode', {
  enumerable: true,
  get() { return process.env.PUBLIC_DEMO_MODE === 'true'; },
});
Object.defineProperty(config, 'enforceCompanyScope', {
  enumerable: true,
  get() { return process.env.ENFORCE_COMPANY_SCOPE === 'true'; },
});

if (isProduction && config.publicDemoMode && !config.disableDestructiveOps) {
  fatal('PUBLIC_DEMO_MODE=true requires DISABLE_DESTRUCTIVE_OPS=true.');
}
if (isProduction && config.publicDemoMode && INSECURE_SECRETS.has(process.env.JWT_SECRET || '')) {
  fatal('PUBLIC_DEMO_MODE=true requires a deployment-supplied JWT_SECRET.');
}

module.exports = config;
