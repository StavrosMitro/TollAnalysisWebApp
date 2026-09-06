const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const DbService = require('../dbService.js');
const json2csv = require('json2csv').parse;
const config = require('../config');

const PREDICT_SCRIPT = path.join(config.paths.mlDir, 'predict.py');

const forecast_controller = async (req, res, next) => {
    try {
        const { company_id, date } = req.params;
        const formatQuery = req.query.format || 'json';

        if (!company_id || !date) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!/^\d{8}$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYYMMDD.' });
        }

        const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

        const dbService = DbService.getDbServiceInstance();
        const tolls_of_company = await dbService.tollstations(company_id);

        if (!tolls_of_company || tolls_of_company.length === 0) {
            return res.status(204).send();
        }

        const tollData = tolls_of_company.map((toll) => ({
            tollID: toll.Toll_id,
            date: formattedDate,
        }));

        const inputDir = path.join(config.paths.runtimeDir, 'forecast_input');
        fs.mkdirSync(inputDir, { recursive: true });
        const filePath = path.join(inputDir, `company_${company_id}_passages.csv`);
        fs.writeFileSync(filePath, json2csv(tollData));

        return makePassagePrediction(company_id, res, formatQuery, filePath);
    } catch (error) {
        console.error('[forecast_controller] Error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

async function makePassagePrediction(company_id, res, formatQuery, inputCsvPath) {
    try {
        const dbService = DbService.getDbServiceInstance();
        const data_for_nop = await dbService.data_for_nop(company_id);

        if (!data_for_nop || data_for_nop.length === 0) {
            return res.status(204).send();
        }

        const modelFilePath = path.join(config.paths.modelsPassages, `model_${company_id}.pkl`);
        if (!fs.existsSync(modelFilePath)) {
            return res.status(204).send();
        }

        const outputDir = path.join(config.paths.runtimeDir, 'forecast_results');
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
            console.error(`[predict.py stderr]: ${data.toString()}`);
        });

        pythonProcess.on('error', (err) => {
            console.error('[makePassagePrediction] failed to start python:', err.message);
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
                        res.attachment(`predictions_${company_id}.csv`);
                        res.status(200).send(json2csv(result));
                    });
                }
                return respond(() => res.status(200).json(result));
            } catch (err) {
                console.error('[makePassagePrediction] bad python output:', err.message);
                return respond(() => res.status(500).json({ error: 'Invalid response from prediction engine' }));
            }
        });
    } catch (error) {
        console.error('[makePassagePrediction] Error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = forecast_controller;
