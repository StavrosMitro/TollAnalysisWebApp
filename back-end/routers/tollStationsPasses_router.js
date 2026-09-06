const express = require('express');
const router = express.Router();
const tollStationsPasses_controller = require('../controllers/tollStationsPasses_controller');
const { authenticateToken, authorizeRole, ANALYTICS_ROLES } = require('../middlewares/authMiddleware');

/**
 * @openapi
 * /api/tollStationPasses/{tollStationID}/{date_from}/{date_to}:
 *   get:
 *     summary: Retrieve toll station pass data.
 *     description: |
 *       Returns pass data for a specific toll station (tollStationID) within a specified date range.
 *       Dates must be in YYYYMMDD format. The query parameter "format" can be used to request the response in CSV format (e.g., format=csv) or JSON (default).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tollStationID
 *         required: true
 *         schema:
 *           type: string
 *         description: "Toll station identifier. Must start with a valid operator code (AM, EG, GE, KO, MO, NAO, NO, OO)."
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
 *                 passList:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       passIndex:
 *                         type: integer
 *                       passID:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                       tagID:
 *                         type: string
 *                       tagProvider:
 *                         type: string
 *                       passType:
 *                         type: string
 *                       passCharge:
 *                         type: number
 *       204:
 *         description: "No content. No toll station pass data found."
 *       400:
 *         description: "Bad request due to missing or invalid parameters."
 *       500:
 *         description: "Internal server error."
 */
router.get('/:tollStationID/:date_from/:date_to', authenticateToken, authorizeRole(ANALYTICS_ROLES), tollStationsPasses_controller.getTollStationPasses);

router.get('*', (req, res) => {
    console.log("400 - Route not found");
    res.status(400).json({ error: "Missing required parameters." });
});

module.exports = router;
