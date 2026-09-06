const path = require('path');
const fs = require('fs');
const DbService = require('../dbService.js'); 
const util = require('util');
const json2csv = require('json2csv').parse; 

const getTollStationPasses = async (req, res, next) => {
    try {
        const { tollStationID, date_from, date_to } = req.params;
        const format = req.query.format || 'json'; // Default μορφή JSON

        if (!tollStationID || !date_from || !date_to) {
            return res.status(400).json({ error: 'Missing required parameters: tollStationID, date_from, date_to' });
        }

        // Έλεγχος αν οι ημερομηνίες είναι σε σωστή μορφή
        if (!/^\d{8}$/.test(date_from) || !/^\d{8}$/.test(date_to)) {
            return res.status(400).json({ error: 'Invalid date format. Expected YYYYMMDD.' });
        }

        if (tollStationID.length<4) {
            return res.status(400).json({ error: 'Wrong required parameter tollStationID' });
        }
        const validPairs = ["AM", "EG", "GE", "KO", "MO", "NAO", "NO", "OO"];

        const isValid = validPairs.some(pair => tollStationID.startsWith(pair));
        
        if (!isValid) {
            return res.status(400).json({ error: 'Wrong required parameter tollStationID' });
        }

        const formattedDateFrom = `${date_from.slice(0, 4)}-${date_from.slice(4, 6)}-${date_from.slice(6, 8)}`;
        const formattedDateTo = `${date_to.slice(0, 4)}-${date_to.slice(4, 6)}-${date_to.slice(6, 8)}`;

        const dbService = DbService.getDbServiceInstance();
        const passes = await dbService.getRecordsBetweenDate(tollStationID, formattedDateFrom, formattedDateTo);

        if (passes.length === 0) {
            return res.status(204).send(); // 204 No Content
        }

        let str1 = tollStationID;
        let result1 = str1.replace(/\d+/g, ''); // Εξαγωγή του ονόματος του χειριστή της σταθμού
        const formatTimestamp = (timestamp) => {
            const date = new Date(timestamp);
            return date.toISOString().replace('T', ' ').slice(0, 19); // Converts to "YYYY-MM-DD HH:MM:SS"
        };
        const response = {
       
            passList: passes.map((pass, index) => ({
                passIndex: index + 1,
                passID: pass.passage_id,
                timestamp: formatTimestamp(pass.timestamp), // Fix timestamp format
                tagID: pass.tagRef,
                tagProvider: pass.tagHomeID,
                passType: result1 === pass.tagHomeID ? 'home' : 'visitor',
                passCharge: parseFloat(pass.charge),
            })),
            
        };

        if (format === 'csv') {
            const csv = json2csv(response.passList); 
            res.header('Content-Type', 'text/csv'); // Ορισμός τύπου περιεχομένου
            res.attachment('toll_passes.csv'); // Όνομα αρχείου
            return res.send(csv);
        }

        res.status(200).json(response); // 200 Success
    } catch (error) {
        console.error('Error fetching toll station passes:', error);
        res.status(500).json({ error: 'Internal Server Error' }); // 500 Internal Server Error
    }
};

module.exports = { getTollStationPasses };
