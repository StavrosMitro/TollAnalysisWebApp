/**
 * Unit tests for the admin controller. Fully mocked - no database, no Python.
 *
 * Intended API (established here, replacing the stale assertions of the old
 * admin.test.js):
 *   - all /api/admin/* routes require an admin token (401 / 403 otherwise)
 *   - when DISABLE_DESTRUCTIVE_OPS=true every mutating route returns
 *     403 {error:{code:"DEMO_MODE_RESTRICTION"}}  (covered in authorization.test.js)
 *   - GET  /users    -> 200 {status:"OK", users:[{user_id,user_email,user_role}]}  (never passwords)
 *   - POST /usermod  -> 201 (created) / 200 (updated); 400 if a field is missing
 *   - POST /resetpasses / /resetstations -> 200 {status:"OK"}
 *   - POST /setrole   -> 200 on success, 404 if the user does not exist, 400 if a field is missing
 */
const request = require('supertest');

jest.mock('../dbService.js');
jest.mock('child_process', () => ({ exec: jest.fn((c, o, cb) => (cb || o)(null, '', '')) }));

const DbService = require('../dbService.js');

const dbMock = {
    getDatabaseStats: jest.fn(async () => ({ n_stations: 1, n_tags: 1, n_passes: 1 })),
    getAllUsers: jest.fn(async () => [
        { user_id: 1, user_email: 'a@b.example', user_password: 'HASH', user_role: 'admin' },
    ]),
    getUser: jest.fn(async () => undefined),
    createUser: jest.fn(async () => ({ created: true })),
    updateUserPassword: jest.fn(async () => ({ updated: true })),
    updateUserRole: jest.fn(async () => ({ updated: true })),
    resetPasses: jest.fn(async () => {}),
    initializeAdminAccount: jest.fn(async () => {}),
    resetTollStations: jest.fn(async () => {}),
};
DbService.getDbServiceInstance.mockReturnValue(dbMock);

const app = require('../app');
const { tokens } = require('./helpers/tokens');
const admin = () => ({ 'x-observatory-auth': tokens.admin() });

beforeEach(() => {
    process.env.DISABLE_DESTRUCTIVE_OPS = 'false';
});

describe('GET /api/admin/users', () => {
    it('401 without a token, 403 for demo', async () => {
        expect((await request(app).get('/api/admin/users')).status).toBe(401);
        expect(
            (await request(app).get('/api/admin/users').set('x-observatory-auth', tokens.demo())).status
        ).toBe(403);
    });

    it('200 with a user list that never contains password hashes', async () => {
        const res = await request(app).get('/api/admin/users').set(admin());
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
        expect(Array.isArray(res.body.users)).toBe(true);
        expect(JSON.stringify(res.body)).not.toMatch(/HASH|user_password/);
        expect(res.body.users[0]).toEqual({ user_id: 1, user_email: 'a@b.example', user_role: 'admin' });
    });
});

describe('POST /api/admin/usermod', () => {
    it('400 when a field is missing', async () => {
        const res = await request(app).post('/api/admin/usermod').set(admin()).send({ user_email: 'x@y.example' });
        expect(res.status).toBe(400);
    });

    it('creates a new user (201) when it does not exist', async () => {
        dbMock.getUser.mockResolvedValueOnce(undefined);
        const res = await request(app)
            .post('/api/admin/usermod')
            .set(admin())
            .send({ user_email: 'new@x.example', user_password: 'secret123' });
        expect(res.status).toBe(201);
        expect(dbMock.createUser).toHaveBeenCalled();
    });

    it('updates the password (200) when the user exists', async () => {
        dbMock.getUser.mockResolvedValueOnce({ user_email: 'new@x.example', user_role: 'admin' });
        const res = await request(app)
            .post('/api/admin/usermod')
            .set(admin())
            .send({ user_email: 'new@x.example', user_password: 'secret123' });
        expect(res.status).toBe(200);
        expect(dbMock.updateUserPassword).toHaveBeenCalled();
    });
});

describe('POST /api/admin/resetpasses', () => {
    it('200 {status:"OK"} and calls the reset', async () => {
        const res = await request(app).post('/api/admin/resetpasses').set(admin());
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
        expect(dbMock.resetPasses).toHaveBeenCalled();
    });

    it('403 DEMO_MODE_RESTRICTION when the demo switch is on', async () => {
        process.env.DISABLE_DESTRUCTIVE_OPS = 'true';
        const res = await request(app).post('/api/admin/resetpasses').set(admin());
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('DEMO_MODE_RESTRICTION');
        expect(dbMock.resetPasses).not.toHaveBeenCalled();
    });
});

describe('POST /api/admin/setrole', () => {
    it('404 when the target user does not exist', async () => {
        dbMock.getUser.mockResolvedValueOnce(undefined);
        const res = await request(app)
            .post('/api/admin/setrole')
            .set(admin())
            .send({ user_email: 'ghost@x.example', user_role: 'admin' });
        expect(res.status).toBe(404);
    });

    it('200 when the user exists', async () => {
        dbMock.getUser.mockResolvedValueOnce({ user_email: 'real@x.example', user_role: 'moreas' });
        const res = await request(app)
            .post('/api/admin/setrole')
            .set(admin())
            .send({ user_email: 'real@x.example', user_role: 'admin' });
        expect(res.status).toBe(200);
        expect(dbMock.updateUserRole).toHaveBeenCalledWith('real@x.example', 'admin');
    });
});
