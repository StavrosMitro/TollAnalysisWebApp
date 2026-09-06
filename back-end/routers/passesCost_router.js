const express = require('express');
const router = express.Router();
const passesCost_controller = require('../controllers/passesCost_controller');
const { authenticateToken, authorizeRole, enforceCompanyScope, ANALYTICS_ROLES } = require('../middlewares/authMiddleware');

/**
 * @openapi
 * /api/passesCost/{tollOpID}/{tagOpID}/{date_from}/{date_to}:
 *   get:
 *     summary: Retrieve pass cost data.
 *     description: |
 *       Returns the toll pass cost data for a combination of toll operator (tollOpID) and tag operator (tagOpID) within a specified date range.
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
 *         name: tagOpID
 *         required: true
 *         schema:
 *           type: string
 *         description: "Tag operator ID. Allowed values: AM, EG, GE, KO, MO, NAO, NO, OO."
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
 *                 tagOpID:
 *                   type: string
 *                 requestTimestamp:
 *                   type: string
 *                   format: date-time
 *                 periodFrom:
 *                   type: string
 *                 periodTo:
 *                   type: string
 *                 nPasses:
 *                   type: integer
 *                 passesCost:
 *                   type: number
 *       204:
 *         description: "No content. No pass cost data found."
 *       400:
 *         description: "Bad request due to missing or invalid parameters."
 *       500:
 *         description: "Internal server error."
 */
router.get('/:tollOpID/:tagOpID/:date_from/:date_to', authenticateToken, authorizeRole(ANALYTICS_ROLES), enforceCompanyScope('tollOpID'), passesCost_controller.passesCost_controller);

router.get('*', (req, res) => {
    console.log("400 - Route not found");
    res.status(400).json({ error: "Missing required parameters." });
});

module.exports = router;