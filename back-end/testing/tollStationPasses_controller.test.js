/**
 * Unit tests for GET /api/tollStationPasses/:id/:from/:to  (controller logic).
 * DB access mocked - no database.
 */
const request = require('supertest');

jest.mock('../dbService.js');
const DbService = require('../dbService.js');

const dbMock = { getRecordsBetweenDate: jest.fn() };
DbService.getDbServiceInstance.mockReturnValue(dbMock);

const app = require('../app');
const { tokens } = require('./helpers/tokens');
const auth = { 'x-observatory-auth': tokens.demo() };

const url = (id, from = '20220101', to = '20220131') =>
    `/api/tollStationPasses/${id}/${from}/${to}`;

describe('GET /api/tollStationPasses', () => {
    it('401 without a token', async () => {
        expect((await request(app).get(url('NAO01'))).status).toBe(401);
    });

    it('400 for an invalid date format', async () => {
        const res = await request(app).get(url('NAO01', '2022-01-01', '20220131')).set(auth);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/date/i);
    });

    it('400 for a too-short / wrong-prefix station id', async () => {
        expect((await request(app).get(url('NO')).set(auth)).status).toBe(400);
        expect((await request(app).get(url('XX99')).set(auth)).status).toBe(400);
    });

    it('204 when there are no passes in range', async () => {
        dbMock.getRecordsBetweenDate.mockResolvedValueOnce([]);
        const res = await request(app).get(url('NAO01')).set(auth);
        expect(res.status).toBe(204);
    });

    it('200 with a well-formed passList when rows exist', async () => {
        dbMock.getRecordsBetweenDate.mockResolvedValueOnce([
            { passage_id: 5, timestamp: '2022-01-10T08:00:00Z', tollID: 'NAO01', tagRef: 'TAG1', tagHomeID: 'NAO', charge: '2.80' },
            { passage_id: 6, timestamp: '2022-01-11T09:00:00Z', tollID: 'NAO01', tagRef: 'TAG2', tagHomeID: 'EG', charge: '2.80' },
        ]);
        const res = await request(app).get(url('NAO01')).set(auth);
        expect(res.status).toBe(200);
        expect(res.body.passList).toHaveLength(2);
        expect(res.body.passList[0]).toMatchObject({
            passIndex: 1,
            passID: 5,
            tagID: 'TAG1',
            passType: 'home',      // tagHomeID 'NAO' == operator prefix
        });
        expect(res.body.passList[1].passType).toBe('visitor'); // tagHomeID 'EG'
        expect(typeof res.body.passList[0].passCharge).toBe('number');
    });

    it('returns text/csv when format=csv', async () => {
        dbMock.getRecordsBetweenDate.mockResolvedValueOnce([
            { passage_id: 5, timestamp: '2022-01-10T08:00:00Z', tollID: 'NAO01', tagRef: 'TAG1', tagHomeID: 'NAO', charge: '2.80' },
        ]);
        const res = await request(app).get(url('NAO01') + '?format=csv').set(auth);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    it('500 (handled, no crash) when the DB throws', async () => {
        dbMock.getRecordsBetweenDate.mockRejectedValueOnce(new Error('db gone'));
        const res = await request(app).get(url('NAO01')).set(auth);
        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toMatch(/db gone/);
    });
});
