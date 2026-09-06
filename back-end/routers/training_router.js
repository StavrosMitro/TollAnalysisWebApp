const express = require('express');
const router = express.Router();
const runPassageTraining = require('../controllers/training_controller');
const runPeakTraining = require('../controllers/peak_training_controller');
const {
    authenticateToken,
    authorizeRole,
    blockDestructiveOps,
    ADMIN_ROLES,
} = require('../middlewares/authMiddleware');

// Model (re)training: expensive, admin only, and gated by the
// destructive-ops switch. The route owns exactly one response.
router.post(
    '/',
    authenticateToken,
    authorizeRole(ADMIN_ROLES),
    blockDestructiveOps,
    async (req, res) => {
        try {
            const passage = await runPassageTraining();
            const peak = await runPeakTraining();

            const errors = [...passage.errors, ...peak.errors];
            if (errors.length > 0) {
                return res.status(207).json({
                    message: 'Training completed with some companies skipped',
                    errors,
                });
            }
            return res.status(200).json({ message: 'Models trained successfully for all companies' });
        } catch (error) {
            console.error('[training_router] Error:', error.message);
            return res.status(500).json({ error: 'Model training failed' });
        }
    }
);

module.exports = router;
