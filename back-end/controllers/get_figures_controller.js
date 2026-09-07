const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const DbService = require('../dbService.js');
const util = require('util');

const get_figures = async (req, res) => {
    // Check the format query parameter
    const format = req.query.format || 'json';
    if (format !== 'csv' && format !== 'json') {
        return res.status(400).json({
            error: 'Invalid format. Must be either "csv" or "json".',
        });
    }

    const figDir = path.join(__dirname, "../debt_figures");

    const figure1_name = 'initial_debts.png';
    const figure2_name = 'final_debts.png';
    const html1_name = 'initial_debts.html';
    const html2_name = 'final_debts.html';
    const csv_name = 'graph2.csv';

    const file_paths = {
        figure1: path.join(figDir, figure1_name),
        figure2: path.join(figDir, figure2_name),
        html1: path.join(figDir, html1_name),
        html2: path.join(figDir, html2_name),
        csv: path.join(figDir, csv_name),
    };

    // Use the DbService to access the database
    const dbService = DbService.getDbServiceInstance();
    try {
        // Check if the files exist before trying to read them
        for (const filePath of Object.values(file_paths)) {
            if (!fs.existsSync(filePath)) {
                // If any of the files are missing, return 204 No Content
                return res.status(204).send();
            }
        }

        // Read the files
        const figure1Data = fs.readFileSync(file_paths.figure1, { encoding: 'base64' });
        const figure2Data = fs.readFileSync(file_paths.figure2, { encoding: 'base64' });
        const html1Data = fs.readFileSync(file_paths.html1, { encoding: 'utf-8' });
        const html2Data = fs.readFileSync(file_paths.html2, { encoding: 'utf-8' });
        const csvData = fs.readFileSync(file_paths.csv, { encoding: 'utf-8' });

        // Prepare data (common across JSON or CSV)
        const message = "Figures of initial debts and debts after the optimization";
        const figure1Base64 = `data:image/png;base64,${figure1Data}`;
        const figure2Base64 = `data:image/png;base64,${figure2Data}`;

        // If the requested format is CSV, return CSV
        if (format === 'csv') {
            // A helper function to escape quotes/newlines for CSV
            const toCsvField = (str) => {
                if (!str) return '';
                // Escape double quotes and replace newlines with spaces
                return str.replace(/"/g, '""').replace(/\r?\n/g, ' ');
            };

            // Convert all fields to CSV-safe values
            const csvMessage   = toCsvField(message);
            const csvFigure1   = toCsvField(figure1Base64);
            const csvFigure2   = toCsvField(figure2Base64);
            const csvHtml1     = toCsvField(html1Data);
            const csvHtml2     = toCsvField(html2Data);
            const csvGraphData = toCsvField(csvData);

            // Create a one-line CSV with headers
            const csvHeader = 'message,figure1,figure2,html1,html2,graphData\n';
            const csvRow = `"${csvMessage}","${csvFigure1}","${csvFigure2}","${csvHtml1}","${csvHtml2}","${csvGraphData}"`;
            const csvContent = csvHeader + csvRow;

            // Set the appropriate Content-Type and return the CSV
            res.setHeader('Content-Type', 'text/csv');
            return res.status(200).send(csvContent);

        } else {
            // Otherwise, return JSON
            return res.status(200).json({
                message,
                figures: {
                    figure1: figure1Base64,
                    figure2: figure2Base64,
                },
                html: {
                    html1: html1Data,
                    html2: html2Data,
                },
                csv: csvData,
            });
        }
    } catch (error) {
        // Handle unexpected errors
        console.error('Error:', error.message || error.stderr || 'Unknown error.');
        return res.status(500).json({
            error: { code: 'FIGURES_UNAVAILABLE', message: 'The optimization figures are unavailable.' },
        });
    }
};

module.exports = { get_figures };
