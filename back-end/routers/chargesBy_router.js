const express = require('express');
const router = express.Router();
const chargesBy_controller = require('../controllers/chargesBy_controller'); 
const { authenticateToken, authorizeRole, ANALYTICS_ROLES } = require('../middlewares/authMiddleware');

/**
 * @openapi
 * /api/chargesBy/{tollOpID}/{date_from}/{date_to}:
 *   get:
 *     summary: Retrieve toll transaction data and costs between companies.
 *     description: |
 *       Returns toll transaction and cost data for a selected toll operator (tollOpID) within a specified date range.
 *       Dates must be in YYYYMMDD format. The query parameter "format" can be used to request the response in CSV format (e.g., format=csv) or JSON (default).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tollOpID
 *         required: true
 *         schema:
 *           type: string
 *         description: "Toll operator ID. Allowed values: AM, EG, GE, KO, MO, NAO, NO, OO."
 *       - in: path
 *         name: date_from
 *         required: true
 *         schema:
 *           type: string
 *         description: "Start date in YYYYMMDD format."
 *       - in: path
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *         description: "End date in YYYYMMDD format."
 *       - in: query
 *         name: format
 *         required: false
 *         schema:
 *           type: string
 *           default: json
 *         description: "Specifies the response format. Options: json or csv."
 *     responses:
 *       200:
 *         description: "Successful response with the requested data."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tollOpID:
 *                   type: string
 *                 requestTimestamp:
 *                   type: string
 *                   format: date-time
 *                 periodFrom:
 *                   type: string
 *                 periodTo:
 *                   type: string
 *                 vOpList:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       visitingOpID:
 *                         type: string
 *                       nPasses:
 *                         type: integer
 *                       passesCost:
 *                         type: number
 *       400:
 *         description: "Bad request due to missing or invalid parameters."
 *       500:
 *         description: "Internal server error."
 */
router.get('/:tollOpID/:date_from/:date_to', authenticateToken, authorizeRole(ANALYTICS_ROLES), chargesBy_controller);

router.get('*', (req, res) => {
    console.log("400 - Route not found");
    res.status(400).json({ error: "Missing required parameters." });
});

module.exports = router;
