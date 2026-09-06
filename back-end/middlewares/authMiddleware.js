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
 * database resets, debt mutation, bulk uploads). When DISABLE_DESTRUCTIVE_OPS
 * is "true" these return 503 instead of running. The flag defaults to false,
 * so existing behaviour is preserved unless a deployment opts in (the bundled
 * docker-compose stack sets it to true).
 */
const blockDestructiveOps = (req, res, next) => {
    if (config.disableDestructiveOps) {
        return res.status(503).json({
            error: 'This operation is disabled in this environment',
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    authorizeRole,
    blockDestructiveOps,
    COMPANY_ROLES,
    ADMIN_ROLES,
    ANALYTICS_ROLES,
};
