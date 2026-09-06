const express = require('express');
const router = express.Router();
const {
    authenticateToken,
    authorizeRole,
    blockDestructiveOps,
    ADMIN_ROLES,
} = require('../middlewares/authMiddleware');
const controller = require('../controllers/cancel_debts_controller');

// Mutates TotalDebts (settles balances to zero) - admin only + destructive switch.
router.patch('/', authenticateToken, authorizeRole(ADMIN_ROLES), blockDestructiveOps, controller.cancel_debts);

module.exports = router;
