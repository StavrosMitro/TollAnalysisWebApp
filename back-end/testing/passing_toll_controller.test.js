/**
 * Unit tests for PUT /api/passing_toll (controller logic).
 * DB + Python + filesystem are mocked. Route requires an admin token and is
 * subject to the destructive-ops switch (switch behaviour lives in
 * authorization.test.js); here the switch is OFF.
 */
const fs = require('fs');
const request = require('supertest');

jest.mock('../dbService.js');
jest.mock('child_process', () => ({
    exec: jest.fn((cmd, optsOrCb, maybeCb) => {
        const cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
        // promisify(exec) resolves with { stdout, stderr }
        cb(null, { stdout: 'python ok', stderr: '' });
    }),
}));

const DbService = require('../dbService.js');
const dbMock = {
    getLastPassageId: jest.fn(),
    getRecordsBetweenIds: jest.fn(),
};
DbService.getDbServiceInstance.mockReturnValue(dbMock);

const app = require('../app');
const { tokens } = require('./helpers/tokens');
const admin = { 'x-observatory-auth': tokens.admin() };

let existsSpy;
beforeEach(() => {
    process.env.DISABLE_DESTRUCTIVE_OPS = 'false';
    existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    dbMock.getLastPassageId.mockResolvedValue(100);
    dbMock.getRecordsBetweenIds.mockResolvedValue([]);
});
afterEach(() => existsSpy.mockRestore());

describe('PUT /api/passing_toll', () => {
    it('401 without a token, 403 for a company user', async () => {
        expect((await request(app).put('/api/passing_toll')).status).toBe(401);
        expect(
            (await request(app).put('/api/passing_toll').set('x-observatory-auth', tokens.company())).status
        ).toBe(403);
    });

    it('400 when the source CSV is absent', async () => {
        existsSpy.mockReturnValue(false);
        const res = await request(app).put('/api/passing_toll').set(admin);
        expect(res.status).toBe(400);
    });

    it('204 when the import adds no new rows', async () => {
        dbMock.getRecordsBetweenIds.mockResolvedValue([]);
        const res = await request(app).put('/api/passing_toll').set(admin);
        expect(res.status).toBe(204);
    });

    it('200 with the inserted rows when the import adds data', async () => {
        dbMock.getLastPassageId.mockResolvedValueOnce(100).mockResolvedValueOnce(102);
        dbMock.getRecordsBetweenIds.mockResolvedValue([
            { passage_id: 101, tollID: 'AM01' },
            { passage_id: 102, tollID: 'AM02' },
        ]);
        const res = await request(app).put('/api/passing_toll').set(admin);
        expect(res.status).toBe(200);
        expect(res.body.insertedRecords).toHaveLength(2);
    });

    it('400 for an unsupported format', async () => {
        const res = await request(app).put('/api/passing_toll?format=xml').set(admin);
        expect(res.status).toBe(400);
    });
});
