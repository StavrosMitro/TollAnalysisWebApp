const express = require('express');
const router = express.Router();
const forecast_controller = require('../controllers/forecast_controller');
const { authenticateToken, authorizeRole, enforceCompanyScope, ANALYTICS_ROLES } = require('../middlewares/authMiddleware');

router.get('/:company_id?/:date?', authenticateToken, authorizeRole(ANALYTICS_ROLES), enforceCompanyScope('company_id'), forecast_controller);

router.get('*', (req, res) => {
    console.log("400 - Route not found");
    res.status(400).json({ error: "Missing required parameters." });
});


module.exports = router;