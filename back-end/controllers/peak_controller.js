const json2csv = require('json2csv').parse;
const { predictPeakHours } = require('../lib/mlInference');

/**
 * GET /api/peak_hour/:company_id/:DateFrom/:DateTo   (dates = YYYYMMDD)
 *
 * For each day in the range, the integer hour (0-23) predicted to have the most
 * passages - chosen as argmax of 24 predicted hourly volumes, not a regressed
 * fractional hour. Uses only the committed, pre-trained v2 artifact.
 * Response keeps an array-friendly `predictions` list and adds `model` /
 * `limitations`.
 */
const peak_controller = async (req, res) => {
    try {
        const { company_id, DateFrom, DateTo } = req.params;
        const format = req.query.format || 'json';

        if (!company_id || !DateFrom || !DateTo) {
            return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'company_id, DateFrom and DateTo are required' } });
        }
        if (!/^\d{8}$/.test(DateFrom) || !/^\d{8}$/.test(DateTo)) {
            return res.status(400).json({ error: { code: 'BAD_DATE', message: 'dates must be YYYYMMDD' } });
        }
        const iso = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

        let result;
        try {
            result = await predictPeakHours(company_id, iso(DateFrom), iso(DateTo));
        } catch (err) {
            const status = err.httpStatus || 500;
            return res.status(status).json({ error: { code: err.code || 'INFERENCE_FAILED', message: err.message } });
        }

        if (format === 'csv') {
            res.header('Content-Type', 'text/csv');
            res.attachment(`peak_hour_${company_id}.csv`);
            return res.status(200).send(json2csv(result.predictions || []));
        }
        return res.status(200).json({ empty: false, ...result });
    } catch (error) {
        console.error('[peak_controller] Error:', error.message);
        return res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
    }
};

module.exports = peak_controller;
