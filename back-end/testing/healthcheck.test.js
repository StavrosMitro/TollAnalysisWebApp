/**
 * Health endpoints must not conflate authentication failure with dependency
 * failure.
 *
 *  GET /healthz                (public)
 *    - DB reachable     -> 200
 *    - DB unavailable    -> 503
 *
 *  GET /api/admin/healthcheck  (admin only)
 *    - no / bad token    -> 401
 *    - non-admin token   -> 403
 *    - admin + DB up     -> 200
 *    - admin + DB down   -> 503   (NOT 401)
 */
const request = require('supertest');

jest.mock('../dbService.js');
const DbService = require('../dbService.js');

const dbMock = {
    ping: jest.fn(),
    getDatabaseStats: jest.fn(),
    getUser: jest.fn(),
};
DbService.getDbServiceInstance.mockReturnValue(dbMock);

const app = require('../app');
const { tokens } = require('./helpers/tokens');

describe('GET /healthz (public)', () => {
    it('200 when the database answers', async () => {
        dbMock.ping.mockResolvedValueOnce(true);
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    });

    it('503 when the database is unavailable', async () => {
        dbMock.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(503);
        expect(res.body).toMatchObject({ status: 'unavailable', database: 'down' });
        expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|stack|password/i);
    });
});

describe('GET /api/admin/healthcheck', () => {
    it('401 with no token', async () => {
        expect((await request(app).get('/api/admin/healthcheck')).status).toBe(401);
    });

    it('401 with an invalid token', async () => {
        const res = await request(app)
            .get('/api/admin/healthcheck')
            .set('x-observatory-auth', 'garbage.token.here');
        expect(res.status).toBe(401);
    });

    it('403 for an authenticated non-admin (demo / company)', async () => {
        expect(
            (await request(app).get('/api/admin/healthcheck').set('x-observatory-auth', tokens.demo())).status
        ).toBe(403);
        expect(
            (await request(app).get('/api/admin/healthcheck').set('x-observatory-auth', tokens.company())).status
        ).toBe(403);
    });

    it('200 for an admin when the database is healthy', async () => {
        dbMock.getDatabaseStats.mockResolvedValueOnce({ n_stations: 253, n_tags: 50, n_passes: 1002 });
        const res = await request(app)
            .get('/api/admin/healthcheck')
            .set('x-observatory-auth', tokens.admin());
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
    });

    it('503 (NOT 401) for an admin when the database is down', async () => {
        dbMock.getDatabaseStats.mockRejectedValueOnce(new Error('connect ETIMEDOUT'));
        const res = await request(app)
            .get('/api/admin/healthcheck')
            .set('x-observatory-auth', tokens.admin());
        expect(res.status).toBe(503);
        expect(res.status).not.toBe(401);
        expect(JSON.stringify(res.body)).not.toMatch(/ETIMEDOUT|password/i);
    });
});
