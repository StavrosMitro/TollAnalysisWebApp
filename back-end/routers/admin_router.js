const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin_controller");
const upload_controller = require("../controllers/upload_passages_controller");
const { authenticateToken, authorizeRole, blockDestructiveOps, ADMIN_ROLES } = require('../middlewares/authMiddleware');

/**
 * @openapi
 * /api/admin/healthcheck:
 *   get:
 *     summary: Healthcheck endpoint for admin.
 *     description: Επιστρέφει πληροφορίες για την κατάσταση της βάσης δεδομένων και του συστήματος.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Επιτυχής απόκριση με τα στατιστικά της βάσης.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 dbconnection:
 *                   type: string
 *                 n_stations:
 *                   type: integer
 *                 n_tags:
 *                   type: integer
 *                 n_passes:
 *                   type: integer
 *       401:
 *         description: Unauthorized.
 */
// Define the healthcheck route
router.get("/healthcheck", authenticateToken, authorizeRole(ADMIN_ROLES), adminController.healthcheck);

/**
 * @openapi
 * /api/admin/resetstations:
 *   post:
 *     summary: Reset toll stations.
 *     description: Διαβάζει δεδομένα από αρχείο CSV και επαναφέρει τις σταθμίδες πληρωμής στη βάση δεδομένων.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Οι σταθμίδες επαναφέρθηκαν επιτυχώς.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       500:
 *         description: Σφάλμα κατά την επαναφορά των σταθμίδων.
 */
// Reset stations route
router.post("/resetstations", authenticateToken, authorizeRole(ADMIN_ROLES), blockDestructiveOps, adminController.resetStations);

/**
 * @openapi
 * /api/admin/resetpasses:
 *   post:
 *     summary: Reset passes.
 *     description: Καθαρίζει τους πίνακες οφειλών και διέρξεων, και προαιρετικά επανεκκινεί τον admin λογαριασμό.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Οι διέρξεις επαναφέρθηκαν επιτυχώς.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       500:
 *         description: Σφάλμα κατά την επαναφορά των διέρξεων.
 */
// Reset passes route
router.post("/resetpasses", authenticateToken, authorizeRole(ADMIN_ROLES), blockDestructiveOps, adminController.resetPasses);

/**
 * @openapi
 * /api/admin/addpasses:
 *   post:
 *     summary: Add passes.
 *     description: Επεξεργάζεται ένα προκαθορισμένο αρχείο CSV με δεδομένα διέρξεων μέσω Python script.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Οι διέρξεις προστέθηκαν επιτυχώς.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       400:
 *         description: Δεν βρέθηκε το αρχείο passages.csv.
 *       500:
 *         description: Σφάλμα κατά την επεξεργασία των διέρξεων.
 */
router.post(
    "/addpasses",
    authenticateToken,
    authorizeRole(ADMIN_ROLES),
    blockDestructiveOps,
    upload_controller.uploadCsv,
    adminController.addPasses
);

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Retrieve list of users.
 *     description: Επιστρέφει μια λίστα με τα ονόματα χρηστών (users) που υπάρχουν στον admin module.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Επιστροφή επιτυχίας με τη λίστα χρηστών.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 users:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Σφάλμα κατά την ανάκτηση των χρηστών.
 */
// Helper routers, will only be used by cli
router.get("/users", authenticateToken, authorizeRole(ADMIN_ROLES), adminController.getUsers);

/**
 * @openapi
 * /api/admin/usermod:
 *   post:
 *     summary: Modify or create a user.
 *     description: Δημιουργεί ή ενημερώνει έναν χρήστη με δεδομένα username και passw.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Δεδομένα χρήστη για δημιουργία ή ενημέρωση.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - passw
 *             properties:
 *               username:
 *                 type: string
 *               passw:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ο χρήστης ενημερώθηκε ή δημιουργήθηκε επιτυχώς.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Ελλιπή δεδομένα (missing username or password).
 *       500:
 *         description: Σφάλμα κατά την ενημέρωση ή δημιουργία του χρήστη.
 */
router.post("/usermod", authenticateToken, authorizeRole(ADMIN_ROLES), adminController.userMod);
router.delete(
  '/userdelete/:username',
  authenticateToken,
  authorizeRole(ADMIN_ROLES),
  adminController.deleteUser
);

router.post(
  '/setrole',
  authenticateToken, 
  authorizeRole(ADMIN_ROLES), 
  adminController.setUserRole
);
module.exports = router;
