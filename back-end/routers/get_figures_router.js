const express = require('express');
const router = express.Router();
const controller = require('../controllers/get_figures_controller');
const { authenticateToken, authorizeRole, ANALYTICS_ROLES } = require('../middlewares/authMiddleware');

router.get('/', authenticateToken, authorizeRole(ANALYTICS_ROLES), controller.get_figures);
//router.get('/', controller.get_figures);
module.exports = router;