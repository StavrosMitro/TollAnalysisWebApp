const { format } = require('date-fns');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const DbService = require('../dbService.js');
const json2csv = require('json2csv').parse;
const config = require('../config');

const COMPANY_IDS = ['AM', 'EG', 'GE', 'KO', 'MO', 'NAO', 'NO', 'OO'];
const TRAIN_SCRIPT = path.join(config.paths.mlDir, 'train_peak_hours.py');

/**
 * Retrains the peak-hour models for every company.
 * Pure worker: returns { errors }; the router owns the HTTP response.
 */
async function runPeakTraining() {
    const dbService = DbService.getDbServiceInstance();
    const errors = [];

    for (const companyId of COMPANY_IDS) {
        const rows = await dbService.get_most_passages_for_date_and_company(companyId);
        const flatData = (rows || []).flat();
        if (!flatData || flatData.length === 0) {
            errors.push({ company: companyId, error: 'No data found' });
            continue;
        }
        const csvFilePath = saveDataToCSV(companyId, flatData);
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
                return reject(new Error(`train_peak_hours.py exited ${code} for ${companyId}: ${stderr.trim()}`));
            }
            resolve();
        });
    });
}

function saveDataToCSV(companyId, data) {
    const folderPath = path.join(config.paths.runtimeDir, 'training_data_peak_hours');
    fs.mkdirSync(folderPath, { recursive: true });

    const flattenedData = data
        .map((item) => {
            let formattedDate = null;
            if (item.passage_date) {
                const parsed = new Date(item.passage_date);
                if (!Number.isNaN(parsed.getTime())) {
                    formattedDate = format(parsed, 'yyyy-MM-dd');
                }
            }
            return {
                passage_date: formattedDate,
                company: item.company,
                hour_of_day: item.hour_of_day,
            };
        })
        .filter((item) => item.passage_date !== null);

    const filePath = path.join(folderPath, `company_${companyId}_passages.csv`);
    fs.writeFileSync(filePath, json2csv(flattenedData), 'utf8');
    return filePath;
}

module.exports = runPeakTraining;
