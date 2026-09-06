const DbService = require("../dbService");
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");
const { exec } = require("child_process");
const bcrypt = require("bcrypt");
const util = require('util');
const config = require('../config');
const execPromise = util.promisify(exec);

// Authenticated admin health probe.
//   - missing / invalid token   -> 401  (authenticateToken middleware)
//   - authenticated non-admin    -> 403  (authorizeRole middleware)
//   - admin + database reachable -> 200
//   - admin + database down      -> 503  (dependency failure, NOT an auth failure)
exports.healthcheck = async (req, res) => {
    const dbServiceInstance = DbService.getDbServiceInstance();
    try {
        const stats = await dbServiceInstance.getDatabaseStats();

        res.status(200).json({
            status: "OK",
            dbconnection: config.db.database,
            n_stations: stats.n_stations,
            n_tags: stats.n_tags,
            n_passes: stats.n_passes,
        });
    } catch (error) {
        console.error("Healthcheck: database unavailable:", error.message);

        res.status(503).json({
            status: "unavailable",
            dbconnection: config.db.database,
        });
    }
};
  
exports.resetStations = async (req, res) => {
    const dbServiceInstance = DbService.getDbServiceInstance();
    const csvFilePath = path.join(__dirname, "../uploads/tolls.csv");

    try {
        // Read and parse the CSV file
        const stationsData = await readCSVFile(csvFilePath);

        // Initialize the toll stations in the database
        await dbServiceInstance.resetTollStations(stationsData);

        res.status(200).json({ status: "OK" });
    } catch (error) {
        console.error("Error resetting toll stations:", error.message);
        res.status(500).json({ status: "failed", info: error.message });
    }
};

// Helper function to read and parse CSV file
const readCSVFile = (filePath) => {
    return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on("data", (row) => {
                // Parse each row and ensure field names match the database columns
                data.push({
                    OpID: row.OpID,
                    Operator: row.Operator,
                    TollID: row.TollID,
                    Name: row.Name,
                    PM: row.PM,
                    Locality: row.Locality,
                    Road: row.Road,
                    Lat: parseFloat(row.Lat),
                    Long: parseFloat(row.Long),
                    Email: row.Email,
                    Price1: parseFloat(row.Price1),
                    Price2: parseFloat(row.Price2),
                    Price3: parseFloat(row.Price3),
                    Price4: parseFloat(row.Price4),
                });
            })
            .on("end", () => resolve(data))
            .on("error", (err) => reject(err));
    });
};
exports.resetPasses = async (req, res) => {
    try {
      const dbServiceInstance = DbService.getDbServiceInstance();
  
      // 1️⃣ Clear Debt and Passages tables
      await dbServiceInstance.resetPasses();
  
      // 2️⃣ Initialize admin account: username=admin, password=freepasses4all
      await dbServiceInstance.initializeAdminAccount(); 
  
      // 3️⃣ Return success
      return res.status(200).json({ status: "OK" });
    } catch (error) {
      console.error("Error resetting passes:", error.message);
      return res
        .status(500)
        .json({ status: "failed", info: error.message });
    }
  };
exports.setUserRole = async (req, res) => {
    try {
    const dbServiceInstance = DbService.getDbServiceInstance();
      const { user_email, user_role } = req.body;
      if (!user_email || !user_role) {
        return res.status(400).json({ error: 'user_email and user_role are required' });
      }
  
      // Check if user exists
      const existingUser = await dbServiceInstance.getUser(user_email);
      if (!existingUser) {
        return res.status(404).json({ error: `User "${user_email}" not found` });
      }
  
      // Update role
      await dbServiceInstance.updateUserRole(user_email, user_role);
  
      return res.status(200).json({ message: `User "${user_email}" role updated to "${user_role}"` });
    } catch (err) {
      console.error('Error in setUserRole:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.addPasses = async (req, res) => {
  try {
      // Define the predefined file path
      const filePath = path.join(__dirname, "../uploads/passages.csv");
      
      console.log("Using predefined file:", filePath);

      // Check if the file exists
      if (!fs.existsSync(filePath)) {
          console.error("File not found:", filePath);
          return res.status(400).json({ status: "failed", info: "File not found: passages.csv" });
      }

      const pythonScript = path.join(config.paths.scriptsDir, "passage2mysql.py");

      // Execute the Python script to process the file (paths are absolute).
      exec(`"${config.pythonBin}" "${pythonScript}" "${filePath}"`, (error, stdout, stderr) => {
          if (error) {
              console.error(`Python script error: ${stderr}`);
              return res.status(500).json({ status: "failed", info: stderr.trim() });
          }

          console.log(`Python script output: ${stdout}`);
          res.status(200).json({ status: "OK" });
      });
  } catch (error) {
      console.error(`Error in addPasses: ${error.message}`);
      res.status(500).json({ status: "failed", info: error.message });
  }
};

exports.getUsers = async (req, res) => {
    try {
        const dbServiceInstance = DbService.getDbServiceInstance();
        const users = await dbServiceInstance.getAllUsers();

        // Send only user_id, user_email, and user_role (not user_password)
        const userList = users.map(user => ({
            user_id: user.user_id,
            user_email: user.user_email,
            user_role: user.user_role
        }));

        res.status(200).json({ status: "OK", users: userList }); 
    } catch (error) {
        console.error("Error in getUsers:", error.message);
        res.status(500).json({ status: "failed", info: error.message });
    }
};

exports.userMod = async (req, res) => {
    const dbServiceInstance = DbService.getDbServiceInstance();
    const { user_email, user_password } = req.body;

    if (!user_email || !user_password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const existingUser = await dbServiceInstance.getUser(user_email);

        if (existingUser) {
            // Update existing user's password
            const hashedPassword = await bcrypt.hash(user_password, 10);
            await dbServiceInstance.updateUserPassword(user_email, hashedPassword);
            return res.status(200).json({ message: `User ${user_email} password updated successfully` });
        } else {
            // Create new user
            const hashedPassword = await bcrypt.hash(user_password, 10);
            await dbServiceInstance.createUser(user_email, hashedPassword);
            return res.status(201).json({ message: `User ${user_email} created successfully` });
        }
    } catch (error) {
        console.error("Error in userMod:", error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteUser = async (req, res) => {
    const dbServiceInstance = DbService.getDbServiceInstance();
    const { username } = req.params; // Retrieve from URL param
  
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
  
    try {
      const existingUser = await dbServiceInstance.getUser(username);
  
      if (!existingUser) {
        return res.status(404).json({ error: `User "${username}" not found` });
      }
  
      // If user exists, delete it
      await dbServiceInstance.deleteUser(username);
      return res.status(200).json({ message: `User "${username}" deleted successfully` });
    } catch (error) {
      console.error('Error in deleteUser:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
};