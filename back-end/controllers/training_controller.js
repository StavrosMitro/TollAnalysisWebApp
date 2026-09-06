const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const DbService = require('../dbService.js');
const json2csv = require('json2csv').parse;
const config = require('../config');

const COMPANY_IDS = ['AM', 'EG', 'GE', 'KO', 'MO', 'NAO', 'NO', 'OO'];
const TRAIN_SCRIPT = path.join(config.paths.mlDir, 'train.py');

/**
 * Retrains the passage-volume models for every company.
 * Pure worker: returns { errors } and never touches the HTTP response
 * (the router owns the single response). Expensive + admin-only.
 */
async function runPassageTraining() {
    const dbService = DbService.getDbServiceInstance();
    const errors = [];

    for (const companyId of COMPANY_IDS) {
        const data = await dbService.data_for_nop(companyId);
        if (!data || data.length === 0) {
            errors.push({ company: companyId, error: 'No data found' });
            continue;
        }
        const csvFilePath = saveDataToCSV(companyId, data);
        await trainModel(companyId, csvFilePath);
    }

    return { errors };
}

function trainModel(companyId, dataCsvPath) {
    return new Promise((resolve, reject) => {
        const proc = spawn(config.pythonBin, [
            TRAIN_SCRIPT,
            '--company', companyId,
            '--data_csv', dataCsvPath,
        ]);

        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`train.py exited ${code} for ${companyId}: ${stderr.trim()}`));
            }
            resolve();
        });
    });
}

function saveDataToCSV(companyId, data) {
    const folderPath = path.join(config.paths.runtimeDir, 'training_data');
    fs.mkdirSync(folderPath, { recursive: true });
    const filePath = path.join(folderPath, `company_${companyId}_passages.csv`);
    fs.writeFileSync(filePath, json2csv(data), 'utf8');
    return filePath;
}

module.exports = runPassageTraining;
