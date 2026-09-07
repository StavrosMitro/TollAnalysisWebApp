const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const DbService = require('../dbService.js'); // Database service
const util = require('util');
const config = require('../config');

// Promisify the exec function for easier use with async/await
const execPromise = util.promisify(exec);

const passing_toll = async (req, res) => {
    // Define the upload directory
    const uploadDir = path.join(config.paths.backendRoot, 'uploads');
    const filename = 'passages.csv';
    const csvFilePath = path.join(uploadDir, filename);

    const scriptDir = config.paths.scriptsDir;
    const script_name = 'passage2mysql.py';
    const python_path = path.join(scriptDir, script_name);

    // Check if the file exists
    if (!fs.existsSync(csvFilePath)) {
        return res.status(400).json({ error: 'File not found in uploads directory.' }); // 400 Bad Request
    }

    // Escape special characters in the path (optional, for safety)
    const escapedFilePath = csvFilePath.replace(/(["\s'$`\\])/g, '\\$1');
    const python_escaped = python_path.replace(/(["\s'$`\\])/g, '\\$1');

    // Use the DbService to access the database
    const dbService = DbService.getDbServiceInstance();
    try {
        console.log('Testing database connection...');
        const lastPassageId = await dbService.getLastPassageId();
        console.log('Database connection test successful. Last passage ID:', lastPassageId);

        console.log("Let's get the p_id");
        const lastPId_before = lastPassageId; // Store the last passage ID before running the script

        // Run the Python script (script + csv paths are absolute).
        const { stdout, stderr } = await execPromise(
            `"${config.pythonBin}" "${python_escaped}" "${escapedFilePath}"`
        );

        // Fetch the new records added since the last passage ID
        const newRecords = await dbService.getRecordsBetweenIds(lastPId_before);
        const lastPId_after = await dbService.getLastPassageId();

        const format = req.query.format || 'json';

        if (format != 'json' && format!='csv') {
            return res.status(400).end();
        }
        // If no new records found
        if (newRecords.length === 0) {
            return res.status(204).json({ error: 'No new records found after last passage.' }); // 404 Not Found
        }

        if (format === 'csv') {
            // Convert records to CSV format
            const csvHeaders = Object.keys(newRecords[0] || {}).join(',');
            const csvRows = newRecords.map(record =>
                Object.values(record).join(',')
            );
            const csvData = [csvHeaders, ...csvRows].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.attachment('new_records.csv');
            return res.send(csvData);
        }

        // Default response as JSON
        res.status(200).json({
            message: stdout.trim(),
            lastPId_before,
            lastPId_after,
            insertedRecords: newRecords,
        });
    } catch (error) {
        // Handle errors in running the Python script or fetching records
        console.error('Error:', error.message || error.stderr || 'Unknown error.');
        res.status(500).json({ error: error.message || 'An unexpected error occurred.' }); // 500 Internal Server Error
    }
};

module.exports = { passing_toll };
