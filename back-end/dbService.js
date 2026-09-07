const fs = require('fs');
const path = require('path'); // To handle folder paths
const { Parser } = require('json2csv');
const bcrypt = require("bcrypt");
const mysql = require('mysql2');
const config = require('./config');

// Create a connection pool instead of a single connection.
// Connection parameters come exclusively from the central config module.
const pool = mysql.createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    port: config.db.port,
    waitForConnections: true,
    connectionLimit: 10,
});

// Promisify the pool.query method for easier use with async/await
const promisePool = pool.promise();
const closePool = () => promisePool.end();
const simulateDbError = () => {
    throw new Error('Simulated Database error');
  };
class DbService {
    // Define static instance to handle singleton pattern
    static instance = null;

    static getDbServiceInstance() {
        if (!this.instance) {
            this.instance = new DbService();
        }
        return this.instance;
    }
    async getLastPassageId() {
        try {
            const query = `SELECT MAX(passage_id) AS lastPassageId FROM Passages`;
            const [rows] = await promisePool.query(query);
            return rows[0]?.lastPassageId || 0; // Return 0 if no records exist
        } catch (error) {
            console.error('Error in getLastPassageId:', error.message);
            throw error;
        }
    }

    // Fetch records between the given passage_id
    async getRecordsBetweenIds(lastPId_before) {
        try {
            const query = `
                SELECT * FROM Passages 
                WHERE passage_id > ? 
                ORDER BY passage_id`;
            const [rows] = await promisePool.query(query, [lastPId_before]);
            return rows;
        } catch (error) {
            console.error('Error in getRecordsBetweenIds:', error.message);
            throw error;
        }
    }
    async getRecordsBetweenDate(tollStationID, dateFrom, dateTo) {
        try {
            const query = `
                SELECT passage_id, timestamp, tollID, tagRef, tagHomeID, charge
                FROM Passages
                WHERE tollID = ? AND DATE(timestamp) BETWEEN ? AND ?`;
            const [rows] = await promisePool.query(query, [tollStationID, dateFrom, dateTo]);
            return rows;
        } catch (error) {
            console.error('Error in getRecordsBetweenDate:', error.message);
            throw error;
        }
    }

    async getPassesBetween2companies(tollOpID, tagOpID, dateFrom, dateTo) {
        try {
            const query = `
                SELECT 
                    COUNT(*) AS nPasses,
                    COALESCE(SUM(amount), 0) AS passesCost
                FROM Debt
                WHERE creditor_company_id = ? 
                  AND debtor_company_id = ? 
                  AND DATE(timestamp) BETWEEN ? AND ?;
            `;
            const [rows] = await promisePool.query(query, [tollOpID, tagOpID, dateFrom, dateTo]);
            return rows[0];
        } catch (error) {
            console.error('Error in getPassesBetween2companies:', error.message);
            throw error;
        }
    }
    async getDebtBetween2companies(tollOpID, tagOpID, dateFrom, dateTo) {
        try {
            const query = `
            SELECT debtor_company_id, count(*) AS nPasses, COALESCE(SUM(amount), 0) AS passesCost
            FROM Debt
            WHERE creditor_company_id = ? 
            AND debtor_company_id = ? 
            AND DATE(timestamp) BETWEEN ? AND ?;
            `;
            const [rows] = await promisePool.query(query, [tollOpID, tagOpID, dateFrom, dateTo]);
            return rows;
        }
        catch (error) {
            console.error('Error in getDebtBetween2companies:', error.message);
            throw error;
        }
    }
    async getpassAnalysis(stationOpID, tagOpID, dateFrom, dateTo) {
        try {
            const query = `
                SELECT 
                    p.passage_id AS passID,
                    p.tollID AS stationID,
                    p.timestamp,
                    p.tagRef AS tagID,
                    p.charge AS passCharge,
                    tl.Toll_id AS tollID
                FROM 
                    Passages p
                JOIN 
                    Transceiver t ON p.tagRef = t.tagRef
                JOIN 
                    Toll tl ON p.tollID = tl.Toll_id
                WHERE 
                    t.company_id = ? AND tl.OpID=?
                    AND DATE(p.timestamp) BETWEEN ? AND ?
            `;
            const [rows] = await promisePool.query(query, [tagOpID, stationOpID, dateFrom, dateTo]);
            return rows;
        } catch (error) {
            console.error('Error in getpassAnalysis:', error.message);
            throw error;
        }
    }
    // Lightweight readiness probe for /healthz.
    async ping() {
        await promisePool.query('SELECT 1');
        return true;
    }

    async getUser(user_email) {
        try {
            const query = `SELECT * FROM user_login WHERE user_email = ?`;
            const [rows] = await promisePool.query(query, [user_email]);
            return rows[0];
        } catch (error) {
            console.error('Error in getUser:', error.message);
        }
    }
    async tollstations(company_id) {
        try {
            const query = `
                SELECT Toll_id FROM Toll 
                WHERE OpID= ? ;`
            const [rows] = await promisePool.query(query, company_id);
            return rows;
        } catch (error) {
            console.error('Error in getRecordsBetweenIds:', error.message);
            throw error;
        }
    }
    async data_for_nop(company_id) {
        try {
            const query = `
                SELECT 
                    p.tollID, 
                    DATE_FORMAT(DATE(p.timestamp), '%Y-%m-%d') AS date, 
                    COUNT(*) AS total_passages
                FROM 
                    Passages p
                JOIN 
                    Toll t ON p.tollID = t.Toll_id
                JOIN 
                    Company c ON t.OpID = c.company_id
                WHERE 
                    c.company_id = ?
                GROUP BY 
                    p.tollID, date;

            `;
            const [rows] = await promisePool.query(query, company_id);

            return rows;
        } catch (error) {
            console.error('Error in data_for_nop:', error.message);
            throw error;
        }
    }
    async data_for_peak_hour(company_id) {
        try {
            const query = `
                SELECT 
                    DATE_FORMAT(p.timestamp, '%Y-%m-%d') AS passage_date, 
                    HOUR(p.timestamp) AS hour, 
                    t.OpID AS OpID, 
                    COUNT(p.passage_id) AS passage_count
                FROM 
                    Passages p
                JOIN 
                    Toll t ON p.tollID = t.Toll_id
                WHERE 
                    t.OpID = ? 
                GROUP BY 
                    passage_date, hour, t.OpID
                ORDER BY 
                    passage_date, hour, t.OpID;
            `;
            
            // Execute the query with company_id
            const [rows] = await promisePool.query(query, company_id);
    
            // console.log('Data fetched from DB:', rows);
            return rows;
        } catch (error) {
            console.error('Error in data_for_peak_hour:', error.message);
            throw error;
        }
    }
    async peak_input_data(company_id, DateFrom, DateTo) {
        try {
            const query = `
                SELECT DATE(p.timestamp) AS passage_date, t.OpID as company
                FROM Passages p 
                JOIN Toll t ON p.tollID = t.Toll_id
                WHERE t.OpID = ? 
                AND DATE(p.timestamp) BETWEEN ? AND ?;
            `;
            // Pass parameters as an array
            const rows = await promisePool.query(query, [company_id, DateFrom, DateTo]);
    
            return rows;
        } catch (error) {
            console.error('Error in data_for_nop:', error.message);
            throw error;
        }
    }
    async getUser(user_email){
        try {
            const query = `SELECT * FROM users WHERE user_email = ?`;
            const [rows] = await promisePool.query(query, [user_email]);
            return rows[0];
        } catch (error) {
            console.error('Error in getUser:', error.message);
        }
    }
    async get_most_passages_for_date_and_company(company_id) {
        try {
            const query = `
                SELECT 
    grouped.passage_date,
    grouped.company,
    grouped.hour_of_day
FROM (
    SELECT 
        DATE(p.timestamp) AS passage_date,
        t.OpID AS company,
        HOUR(p.timestamp) AS hour_of_day,
        COUNT(*) AS passages_count
    FROM Passages p
    JOIN Toll t ON p.tollID = t.Toll_id
    GROUP BY passage_date, company, hour_of_day
) AS grouped
WHERE grouped.company = ?
  AND (grouped.passage_date, grouped.company, grouped.passages_count) IN (
      SELECT 
          passage_date,
          company,
          MAX(passages_count) AS max_passages_count
      FROM (
          SELECT 
              DATE(p.timestamp) AS passage_date,
              t.OpID AS company,
              HOUR(p.timestamp) AS hour_of_day,
              COUNT(*) AS passages_count
          FROM Passages p
          JOIN Toll t ON p.tollID = t.Toll_id
          GROUP BY passage_date, company, hour_of_day
      ) AS subquery
      GROUP BY passage_date, company
  )
ORDER BY grouped.passage_date;

            `;
            const rows = await promisePool.query(query, company_id);
            return rows;
        } catch (error) {
            console.error('Error in getting most passages for date and company:', error.message);
            throw error;
        }
    }
    async getDatabaseStats() {
        try {
            // Fetch the counts from respective tables
            const [stations] = await promisePool.query("SELECT COUNT(*) AS count FROM Toll");
            const [tags] = await promisePool.query("SELECT COUNT(*) AS count FROM Transceiver");
            const [passes] = await promisePool.query("SELECT COUNT(*) AS count FROM Passages");
    
            // Return the stats in the desired format
            return {
                n_stations: stations[0].count,
                n_tags: tags[0].count,
                n_passes: passes[0].count,
            };
        } catch (error) {
            console.error('Error in getDatabaseStats:', error.message);
            throw error;
        }
    }
    async resetTollStations() {
        const connection = await promisePool.getConnection();
        try {
            await connection.beginTransaction();
    
            // Clear dependent rows in Debt and Passages tables
            await connection.query("DELETE FROM Debt");
            await connection.query("DELETE FROM Passages");
    
            // Clear Toll table
            await connection.query("DELETE FROM Toll");
    
            // Insert data from the CSV file into the Toll table
            const csvFilePath = path.join(__dirname, "./uploads/tolls.csv");
            const csvData = fs.readFileSync(csvFilePath, "utf-8");
    
            const rows = csvData.split("\n").slice(1).filter(Boolean); // Skip header row
            for (const row of rows) {
                const [
                    OpID,
                    Operator,
                    TollID,
                    Name,
                    PM,
                    Locality,
                    Road,
                    Lat,
                    Long,
                    Email,
                    Price1,
                    Price2,
                    Price3,
                    Price4,
                ] = row.split(",");
    
                await connection.query(
                    `INSERT INTO Toll (Toll_id, Latitude, Longitude, Name, Locality, Road, Operator, OpID, Email, Price1, Price2, Price3, Price4)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [TollID, Lat, Long, Name, Locality, Road, Operator, OpID, Email, Price1, Price2, Price3, Price4]
                );
            }
    
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            console.error("Error in resetTollStations:", error.message);
            throw error;
        } finally {
            connection.release();
        }
    }
    async getUser(user_email){
        try {
            const query = `SELECT * FROM users WHERE user_email = ?`;
            const [rows] = await promisePool.query(query, [user_email]);
            return rows[0];
        } catch (error) {
            console.error('Error in getUser:', error.message);
        }
    }
    async resetPasses() {
        const connection = await promisePool.getConnection();
        try {
            await connection.beginTransaction();
    
            // Clear Debt and Passages tables
            await connection.query("DELETE FROM Debt");
            await connection.query("DELETE FROM Passages");
    
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            console.error("Error in resetPasses:", error.message);
            throw error;
        } finally {
            connection.release();
        }
    }
    async initializeAdminAccount() {
        const connection = await promisePool.getConnection();
        try {
          await connection.beginTransaction();
      
          // Hash the default admin password
          const hashedPassword = await bcrypt.hash("freepasses4all", 10);
      
          // Check if the user with user_email='admin' exists
          const [rows] = await connection.query("SELECT * FROM users WHERE user_email = 'admin'");
          if (rows.length === 0) {
            // Insert a new admin user if not found
            await connection.query(
              "INSERT INTO users (user_email, user_password, user_role) VALUES (?, ?, 'admin')",
              ["admin", hashedPassword]
            );
            console.log("Admin account created.");
          } else {
            // Update the existing user to reset its password to freepasses4all
            await connection.query(
              "UPDATE users SET user_password = ?, user_role='admin' WHERE user_email = 'admin'",
              [hashedPassword]
            );
            console.log("Admin account password reset.");
          }
      
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          console.error("Error in initializeAdminAccount:", error.message);
          throw error;
        } finally {
          connection.release();
        }
    }
    async updateUserRole(user_email, newRole) {
        try {
          // This assumes your 'users' table has user_role = ENUM(...) containing newRole
          const query = "UPDATE users SET user_role = ? WHERE user_email = ?";
          await promisePool.query(query, [newRole, user_email]);
          return { updated: true };
        } catch (error) {
          console.error('Error in updateUserRole:', error.message);
          throw error;
        }
    }
    async getAllUsers() {
        try {
            // Use promisePool.query instead of connection.query
            const [rows] = await promisePool.query("SELECT user_id, user_email, user_role FROM users");
    
            return rows;
        } catch (error) {
            console.error("Database error in getAllUsers:", error.message);
            return [];
        }
    }
    async updateUserPassword(user_email, hashedPassword) {
        try {
            const query = "UPDATE users SET user_password = ? WHERE user_email = ?";
            await promisePool.query(query, [hashedPassword, user_email]);
            return { updated: true };
        } catch (error) {
            console.error("Error in updateUserPassword:", error.message);
            throw error;
        }
    }
    async deleteUser(user_email) {
        try {
          const query = "DELETE FROM users WHERE user_email = ?";
          await promisePool.query(query, [user_email]);
          return { deleted: true };
        } catch (error) {
          console.error("Error in deleteUser:", error.message);
          throw error;
        }
    }
    async createUser(user_email, hashedPassword) {
        try {
            const query = "INSERT INTO users (user_email, user_password, user_role) VALUES (?, ?, 'admin')";
            await promisePool.query(query, [user_email, hashedPassword]);
            return { created: true };
        } catch (error) {
            console.error("Error in createUser:", error.message);
            throw error;
        }
    }
    async createOrUpdateUser(user_email, hashedPassword) {
        try {
            // Έλεγχος αν υπάρχει ήδη χρήστης με το δοσμένο email
            const checkQuery = "SELECT COUNT(*) AS count FROM users WHERE user_email = ?";
            const [rows] = await promisePool.query(checkQuery, [user_email]);
    
            if (rows[0].count > 0) {
                // Ενημέρωση μόνο του κωδικού (user_password) για υπάρχοντα χρήστη,
                // αφήνοντας ανέπαφο το πεδίο user_role
                const updateQuery = "UPDATE users SET user_password = ? WHERE user_email = ?";
                await promisePool.query(updateQuery, [hashedPassword, user_email]);
                return { modified: true };
            } else {
                // Δημιουργία νέου χρήστη χωρίς να ορίζεται ρητά το user_role.
                // Έτσι, το πεδίο αυτό δεν τροποποιείται από αυτή τη λειτουργία
                // (θα χρησιμοποιηθεί είτε η προκαθορισμένη τιμή της βάσης είτε
                // θα οριστεί από κάποιο άλλο μηχανισμό).
                const insertQuery = "INSERT INTO users (user_email, user_password) VALUES (?, ?)";
                await promisePool.query(insertQuery, [user_email, hashedPassword]);
                return { created: true };
            }
        } catch (error) {
            console.error("Error in createOrUpdateUser:", error.message);
            throw error;
        }
    }
    
}
module.exports = DbService;
module.exports.closePool = closePool;
