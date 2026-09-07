const DbService = require('../dbService.js');
const json2csv = require('json2csv').parse;
const { forecastVolume } = require('../lib/mlInference');

/**
 * GET /api/forecast/:company_id/:date       (date = YYYYMMDD)
 *
 * Passage-volume forecast for every toll station of an operator on a future
 * date. Uses only the committed, pre-trained v2 artifact - it never trains.
 * Response keeps `predictions` (array, one per station) and adds `model` /
 * `limitations` / per-station detail.
 */
const forecast_controller = async (req, res) => {
    try {
        const { company_id, date } = req.params;
        const format = req.query.format || 'json';

        if (!company_id || !date) {
            return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'company_id and date are required' } });
        }
        if (!/^\d{8}$/.test(date)) {
            return res.status(400).json({ error: { code: 'BAD_DATE', message: 'date must be YYYYMMDD' } });
        }
        const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

        const dbService = DbService.getDbServiceInstance();
        const stationRows = await dbService.tollstations(company_id);
        if (!stationRows || stationRows.length === 0) {
            return res.status(404).json({ error: { code: 'UNKNOWN_OPERATOR', message: `no toll stations found for operator '${company_id}'` } });
        }
        const stations = stationRows.map((r) => r.Toll_id);

        let result;
        try {
            result = await forecastVolume(company_id, isoDate, stations);
        } catch (err) {
            const status = err.httpStatus || 500;
            return res.status(status).json({ error: { code: err.code || 'INFERENCE_FAILED', message: err.message } });
        }

        if (format === 'csv') {
            res.header('Content-Type', 'text/csv');
            res.attachment(`forecast_${company_id}_${date}.csv`);
            return res.status(200).send(json2csv(result.stations || []));
        }
        return res.status(200).json({ empty: false, ...result });
    } catch (error) {
        console.error('[forecast_controller] Error:', error.message);
        return res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
    }
};

module.exports = forecast_controller;
