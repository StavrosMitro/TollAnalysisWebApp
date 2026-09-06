const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const DbService = require('../dbService.js');
const json2csv = require('json2csv').parse;
const config = require('../config');

const PREDICT_SCRIPT = path.join(config.paths.mlDir, 'predict_peak_hours.py');

const peak_controller = async (req, res, next) => {
    try {
        const { company_id, DateFrom, DateTo } = req.params;
        const formatQuery = req.query.format || 'json';

        if (!company_id || !DateFrom || !DateTo) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!/^\d{8}$/.test(DateFrom) || !/^\d{8}$/.test(DateTo)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYYMMDD.' });
        }

        const startDate = new Date(`${DateFrom.slice(0, 4)}-${DateFrom.slice(4, 6)}-${DateFrom.slice(6, 8)}`);
        const endDate = new Date(`${DateTo.slice(0, 4)}-${DateTo.slice(4, 6)}-${DateTo.slice(6, 8)}`);

        const dateArray = [];
        const currentDate = startDate;
        while (currentDate <= endDate) {
            dateArray.push(currentDate.toISOString().slice(0, 10));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const dbService = DbService.getDbServiceInstance();
        const tolls_of_company = await dbService.peak_input_data(company_id, DateFrom, DateTo);

        const csvData = [];
        (tolls_of_company || []).forEach(() => {
            dateArray.forEach((d) => {
                csvData.push({ passage_date: d, company: company_id });
            });
        });

        const inputDir = path.join(config.paths.runtimeDir, 'peak_input');
        fs.mkdirSync(inputDir, { recursive: true });
        const filePath = path.join(inputDir, `company_${company_id}_passages.csv`);
        fs.writeFileSync(filePath, json2csv(csvData));

        return makePeakHourPrediction(company_id, res, formatQuery, filePath);
    } catch (error) {
        console.error('[peak_controller] Error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

async function makePeakHourPrediction(company_id, res, formatQuery, inputCsvPath) {
    try {
        const dbService = DbService.getDbServiceInstance();
        const data_for_peak = await dbService.data_for_peak_hour(company_id);

        if (!data_for_peak || data_for_peak.length === 0) {
            return res.status(204).send();
        }

        const modelFilePath = path.join(config.paths.modelsPeakHours, `model_${company_id}.pkl`);
        if (!fs.existsSync(modelFilePath)) {
            return res.status(204).send();
        }

        const outputDir = path.join(config.paths.runtimeDir, 'peak_results');
        fs.mkdirSync(outputDir, { recursive: true });
        const outputCsvPath = path.join(outputDir, `output_${company_id}_passages.csv`);

        const pythonProcess = spawn(config.pythonBin, [
            PREDICT_SCRIPT,
            '--company', company_id,
            '--input_csv', inputCsvPath,
            '--model_path', modelFilePath,
            '--output_csv', outputCsvPath,
        ]);

        let pythonOutput = '';
        let responded = false;
        const respond = (fn) => {
            if (responded || res.headersSent) return;
            responded = true;
            fn();
        };

        pythonProcess.stdout.on('data', (data) => { pythonOutput += data.toString(); });
        pythonProcess.stderr.on('data', (data) => {
            console.error(`[predict_peak_hours.py stderr]: ${data.toString()}`);
        });

        pythonProcess.on('error', (err) => {
            console.error('[makePeakHourPrediction] failed to start python:', err.message);
            respond(() => res.status(500).json({ error: 'Prediction engine unavailable' }));
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return respond(() => res.status(500).json({ error: 'Error making predictions' }));
            }
            try {
                const result = JSON.parse(pythonOutput);
                if (!result || result.length === 0) {
                    return respond(() => res.status(204).send());
                }
                if (formatQuery === 'csv') {
                    return respond(() => {
                        res.header('Content-Type', 'text/csv');
                        res.status(200).send(json2csv(result));
                    });
                }
                return respond(() => res.status(200).json(result));
            } catch (err) {
                console.error('[makePeakHourPrediction] bad python output:', err.message);
                return respond(() => res.status(500).json({ error: 'Invalid response from prediction engine' }));
            }
        });
    } catch (error) {
        console.error('[makePeakHourPrediction] Error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = peak_controller;
