const express = require('express');
const { uploadCsv } = require('../controllers/upload_passages_controller');
const router = express.Router();
const { authenticateToken, authorizeRole, blockDestructiveOps, ADMIN_ROLES } = require('../middlewares/authMiddleware');

// Bulk CSV upload triggers a DB-mutating Python job - admin only, and
// subject to the destructive-ops switch.
router.post('/', authenticateToken, authorizeRole(ADMIN_ROLES), blockDestructiveOps, uploadCsv);
//router.post('/', uploadCsv);
module.exports = router; 
