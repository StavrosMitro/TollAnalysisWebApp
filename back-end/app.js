const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const DbService = require('./dbService');

const app = express();

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

// Deliberately hand-written rather than a broad header package: PyVis is
// delivered in a sandboxed srcdoc iframe and needs its pinned CDN scripts plus
// inline generated bootstrap code. The main application otherwise remains
// same-origin only.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; " +
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
        "connect-src 'self'; font-src 'self' data:; frame-src 'self'"
    );
    if (config.isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

if (config.isProduction) {
    app.use((req, res, next) => {
        const started = process.hrtime.bigint();
        res.on('finish', () => {
            const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
            // Never log request bodies, authorization headers, query strings,
            // database errors, tokens, or stack traces.
            console.log(JSON.stringify({
                level: 'info', event: 'http_request', method: req.method,
                path: req.path, status: res.statusCode, duration_ms: Math.round(durationMs),
            }));
        });
        next();
    });
}

// --- Middleware ----------------------------------------------------------
// CORS is driven entirely by configuration. In production the frontend is
// served same-origin so the allow-list is empty by default (no cross-origin
// access); in development it defaults to http://localhost:3000.
const corsOptions =
  config.corsOrigins.length > 0
    ? { origin: config.corsOrigins, allowedHeaders: ['Content-Type', 'x-observatory-auth'] }
    : { origin: false };
app.use(cors(corsOptions));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Static assets that pre-date this change (sample figures / uploads).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/debt_figures', express.static(path.join(__dirname, 'debt_figures')));

// --- Health check ------------------------------------------------------
// Public, unauthenticated. Returns 200 only when the process is up AND the
// database answers; 503 (non-sensitive body) otherwise. Used by
// docker-compose / hosting platforms for readiness.
app.get('/healthz', async (req, res) => {
    try {
        await DbService.getDbServiceInstance().ping();
        return res.status(200).json({ status: 'ok', database: 'up' });
    } catch (err) {
        return res.status(503).json({ status: 'unavailable', database: 'down' });
    }
});

// Liveness deliberately does not query MySQL: it lets a platform distinguish
// a healthy Node process from a temporarily unavailable dependency.
app.get('/livez', (req, res) => res.status(200).json({ status: 'ok' }));

// --- Swagger / OpenAPI -------------------------------------------------
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Toll Analysis API',
            version: '1.0.0',
            description: 'REST API for the Toll Passages Management and Analysis application.',
        },
        servers: [{ url: '/api', description: 'Same-origin API' }],
    },
    apis: [path.join(__dirname, 'routers', '*.js')],
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
});

// --- API routes ------------------------------------------------------
const passing_toll_routes = require('./routers/passing_toll_router');
const upload_passages_routes = require('./routers/upload_passages_router');
const cancel_debts = require('./routers/cancel_debts_router');
const get_figures = require('./routers/get_figures_router');
const tollStationRouter = require('./routers/tollStationsPasses_router');
const passesCost = require('./routers/passesCost_router');
const tollRouter = require('./routers/tollRouter');
const chargesBy = require('./routers/chargesBy_router');
const passAnalysis = require('./routers/passAnalysis_router');
const forecast = require('./routers/forecast_router');
const authRouter = require('./routers/auth_router');
const training = require('./routers/training_router');
const peak_hour = require('./routers/peak_hour_router');
const adminRouter = require('./routers/admin_router');

app.use('/api/passing_toll', passing_toll_routes);
app.use('/api/upload_passages', upload_passages_routes);
app.use('/api/cancel_debts', cancel_debts);
app.use('/api/get_debts_optimization', get_figures);
app.use('/api/tollStationPasses', tollStationRouter);
app.use('/api/passesCost', passesCost);
app.use('/api/chargesBy', chargesBy);
app.use('/api/passAnalysis', passAnalysis);
app.use('/api', authRouter);
app.get('/api/public-config', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ publicDemoMode: config.publicDemoMode });
});
app.use('/api', tollRouter);
app.use('/api/forecast', forecast);
app.use('/api/peak_hour', peak_hour);
app.use('/api/training', training);
app.use('/api/admin', adminRouter);

// Unknown API endpoint -> 400 (kept for backwards compatibility).
app.use('/api', (req, res) => {
    res.status(400).json({ error: 'Invalid API endpoint' });
});

// --- React production build (same-origin serving) --------------------
// When a build is present the backend serves it and provides the SPA
// history fallback WITHOUT intercepting /api/* (already handled above).
const clientBuildDir = config.paths.clientBuild;
const clientIndexHtml = path.join(clientBuildDir, 'index.html');

if (fs.existsSync(clientIndexHtml)) {
    app.use(express.static(clientBuildDir));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path === '/healthz') return next();
        return res.sendFile(clientIndexHtml);
    });
} else {
    app.get('/', (req, res) => {
        res.status(200).send('Toll Analysis API is running. No frontend build bundled.');
    });
}

// Final catch-all.
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Centralised error handler (last resort - avoids hanging requests and
// double responses when a route handler throws synchronously).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('[unhandled error]', err && err.message);
    if (res.headersSent) return;
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
    }
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
});

module.exports = app;
