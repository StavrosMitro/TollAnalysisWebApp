const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Role model (as stored in the `users.user_role` ENUM):
 *   - 'admin'                                    -> full access
 *   - company roles: 'aodos', 'gefyra', 'egnatia', 'kentrikiodos',
 *     'moreas', 'neaodos', 'olympiaodos'         -> read / analytics / forecast
 *   - 'demo' (added later)                       -> same as company roles, read-only
 *
 * The previous code checked `authorizeRole(["users","admin"])` on every
 * analytics route, but no user ever has the role "users", so only the master
 * admin account worked. These sets fix that without changing the DB schema.
 */
const COMPANY_ROLES = [
    'aodos',
    'gefyra',
    'egnatia',
    'kentrikiodos',
    'moreas',
    'neaodos',
    'olympiaodos',
];

const ADMIN_ROLES = ['admin'];

// Roles allowed to read data / run (pre-trained) predictions.
const ANALYTICS_ROLES = ['admin', 'demo', ...COMPANY_ROLES];

// Company role -> the operator id it "owns". Six are unambiguous by name.
// `aodos` is deliberately absent: it maps to either AM (Aegean Motorway) or
// NAO (Naodos S.A.) and the codebase never pinned it down - with company-scope
// enforcement on, an `aodos` user therefore fails closed until it is resolved.
const ROLE_TO_COMPANY = {
    gefyra: 'GE',
    egnatia: 'EG',
    kentrikiodos: 'KO',
    moreas: 'MO',
    neaodos: 'NO',
    olympiaodos: 'OO',
};

const operatorPrefix = (value) => {
    const m = /^[A-Za-z]+/.exec(String(value || ''));
    return m ? m[0].toUpperCase() : null;
};

/**
 * Optional company-data isolation for operator-scoped endpoints. No-op unless
 * ENFORCE_COMPANY_SCOPE=true. admin and demo are always allowed (demo is a
 * platform-wide read-only observer). A company user may only pass their own
 * operator id in the named route params (station-vs-tag pairwise endpoints
 * only check the caller's "own" side).
 */
const enforceCompanyScope = (...routeParams) => (req, res, next) => {
    if (!config.enforceCompanyScope) return next();
    const role = req.user && req.user.user_role;
    if (role === 'admin' || role === 'demo') return next();

    const own = ROLE_TO_COMPANY[role];
    const requested = routeParams
        .map((p) => operatorPrefix(req.params[p]))
        .filter(Boolean);

    if (!own || requested.some((op) => op !== own)) {
        return res.status(403).json({
            error: {
                code: 'COMPANY_SCOPE_RESTRICTION',
                message: "You may only access your own company's data.",
            },
        });
    }
    return next();
};

/**
 * Validates the JWT provided in the custom X-OBSERVATORY-AUTH header.
 */
const authenticateToken = (req, res, next) => {
    const token = req.headers['x-observatory-auth'];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Token missing' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

const authorizeRole = (requiredRoles) => {
    return (req, res, next) => {
        if (req.user && requiredRoles.includes(req.user.user_role)) {
            next();
        } else {
            res.status(403).json({ error: 'Access Denied - Insufficient Permissions' });
        }
    };
};

/**
 * Guards destructive / computationally expensive operations (model training,
 * database resets, debt mutation, bulk uploads, user administration). When
 * DISABLE_DESTRUCTIVE_OPS is "true" these are intentionally forbidden and
 * return 403 with a stable machine-readable code - NOT 503, which is reserved
 * for temporary unavailability. The flag defaults to false; the bundled
 * docker-compose stack sets it to true.
 *
 * The `demo` role can never reach these handlers anyway (destructive routes
 * require ADMIN_ROLES), so demo users are safe regardless of the flag.
 */
const blockDestructiveOps = (req, res, next) => {
    if (config.disableDestructiveOps) {
        return res.status(403).json({
            error: {
                code: 'DEMO_MODE_RESTRICTION',
                message: 'This operation is disabled in the public demo.',
            },
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    authorizeRole,
    blockDestructiveOps,
    enforceCompanyScope,
    ROLE_TO_COMPANY,
    COMPANY_ROLES,
    ADMIN_ROLES,
    ANALYTICS_ROLES,
};
