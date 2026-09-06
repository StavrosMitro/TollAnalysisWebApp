const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const controller = require('../controllers/auth_controller');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Rate limits for the credential / token-issuing endpoints. Keyed by IP.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' },
});

const demoLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: 'DEMO_RATE_LIMITED',
            message: 'Too many demo sessions from this address. Please wait a few minutes.',
        },
    },
});

router.post('/login', loginLimiter, controller.authenticate);
router.post('/auth/demo-login', demoLimiter, controller.demoLogin);
router.post('/logout', controller.logout);
router.get('/whoami', authenticateToken, controller.whoami);

module.exports = router;
