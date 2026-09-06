const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const config = require('../config');

// Promisify the exec function for easier use with async/await
const execPromise = util.promisify(exec);

const cancel_debts = async (req, res) => {
    const scriptDir = config.paths.scriptsDir;
    const pythonPath = path.join(scriptDir, 'cancelling_algo.py');

    const uploadDir = config.paths.debtFigures;

    try {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // cancelling_algo.py resolves its own output dir from __file__, so it is
        // independent of the server's working directory.
        const { stdout } = await execPromise(`"${config.pythonBin}" "${pythonPath}"`);

        const filePaths = stdout.trim().split('\n');

        console.log("The filepaths of the figures are:", filePaths);

        if (filePaths.length === 0 || filePaths[0] === '') {
            return res.status(204).send(); // No Content
        }

        // Move the .png files to the uploads directory
        const movedFiles = [];
        filePaths.forEach((file) => {
            const oldPath = path.resolve(file.trim());
            const newPath = path.join(uploadDir, path.basename(file.trim()));

            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                movedFiles.push(newPath);
                console.log(`Moved file: ${oldPath} -> ${newPath}`);
            } else {
                console.warn(`File not found: ${oldPath}`);
            }
        });

        // If no files were successfully moved, return a 204 No Content response
        if (movedFiles.length === 0) {
            return res.status(204).send(); // No Content
        }

        // Check the requested format (json or csv)
        const format = req.query.format || 'json';

        if (format === 'csv') {
            // Convert the moved files list to CSV format
            const csvHeaders = 'File Name, File Path';
            const csvRows = movedFiles.map(file => {
                return `"${path.basename(file)}", "${file}"`; // CSV format: file name and full path
            });

            const csvData = [csvHeaders, ...csvRows].join('\n');

            // Set the response headers for CSV and send the data
            res.setHeader('Content-Type', 'text/csv');
            res.attachment('moved_files.csv');
            return res.send(csvData);
        }

        // Default response as JSON (if files are moved successfully)
        res.status(200).json({
            message: "The .png files have been processed and moved to the uploads directory.",
            files: movedFiles,
        });
    } catch (error) {
        // Handle errors during the Python script execution
        console.error('An error occurred:', error.message || 'Unknown error.');
        res.status(500).json({
            error: error.message || 'An unexpected error occurred.',
        });
    }
};

module.exports = { cancel_debts };