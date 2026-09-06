const express = require('express');
const router = express.Router();
const controller = require('../controllers/passing_toll_controller');
const {
    authenticateToken,
    authorizeRole,
    blockDestructiveOps,
    ADMIN_ROLES,
} = require('../middlewares/authMiddleware');

// Runs a DB-mutating Python import over uploads/passages.csv - admin only + destructive switch.
router.put('/', authenticateToken, authorizeRole(ADMIN_ROLES), blockDestructiveOps, controller.passing_toll);

module.exports = router;
