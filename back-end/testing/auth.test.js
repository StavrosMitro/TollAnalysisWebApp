/**
 * Unit tests for authentication: normal login, public demo login, and the
 * guarantees that matter for a public deployment (no role escalation, short
 * demo token, expiry handling). DB access is mocked.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../dbService.js');
const DbService = require('../dbService.js');
const config = require('../config');

const users = {};
const dbMock = {
    getUser: jest.fn(async (email) => users[email]),
    ping: jest.fn(async () => true),
};
DbService.getDbServiceInstance.mockReturnValue(dbMock);

const app = require('../app');

function decode(token) {
    return jwt.verify(token, config.jwtSecret);
}

beforeAll(async () => {
    users['admin@yme.gov.gr'] = {
        user_id: 10,
        user_email: 'admin@yme.gov.gr',
        user_password: await bcrypt.hash('yme123!', 10),
        user_role: 'admin',
    };
    users[config.demo.email] = {
        user_id: 99,
        user_email: config.demo.email,
        user_password: await bcrypt.hash('irrelevant', 10),
        user_role: 'demo',
    };
});

describe('POST /api/login', () => {
    it('issues a token for valid credentials', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ user_email: 'admin@yme.gov.gr', user_password: 'yme123!' });
        expect(res.status).toBe(200);
        expect(decode(res.body.token).user_role).toBe('admin');
    });

    it('rejects a wrong password with 401', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ user_email: 'admin@yme.gov.gr', user_password: 'nope' });
        expect(res.status).toBe(401);
        expect(res.body).not.toHaveProperty('token');
    });

    it('rejects an unknown user with 404', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ user_email: 'ghost@nowhere.example', user_password: 'x' });
        expect(res.status).toBe(404);
    });

    it('rejects a missing field with 400', async () => {
        const res = await request(app).post('/api/login').send({ user_email: 'a@b.example' });
        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/demo-login', () => {
    it('issues a demo-scoped token with no input', async () => {
        const res = await request(app).post('/api/auth/demo-login');
        expect(res.status).toBe(200);
        const claims = decode(res.body.token);
        expect(claims.user_role).toBe('demo');
        expect(res.body.role).toBe('demo');
    });

    it('token carries ONLY the demo role - not admin or a company role', async () => {
        const res = await request(app).post('/api/auth/demo-login');
        const claims = decode(res.body.token);
        expect(claims.user_role).toBe('demo');
        expect(claims).not.toHaveProperty('user_id');
        // No company role, no admin.
        expect(['admin', 'aodos', 'gefyra', 'egnatia', 'kentrikiodos', 'moreas', 'neaodos', 'olympiaodos'])
            .not.toContain(claims.user_role);
    });

    it('IGNORES a body that tries to escalate role / pick an identity', async () => {
        const res = await request(app)
            .post('/api/auth/demo-login')
            .send({ user_role: 'admin', role: 'admin', user_email: 'admin@yme.gov.gr', company: 'AM' });
        expect(res.status).toBe(200);
        const claims = decode(res.body.token);
        expect(claims.user_role).toBe('demo');
        expect(claims.user_email).toBe(config.demo.email);
    });

    it('token expiry is within the required 60-120 minute window', async () => {
        const res = await request(app).post('/api/auth/demo-login');
        const claims = decode(res.body.token);
        const ttlMinutes = (claims.exp - claims.iat) / 60;
        expect(ttlMinutes).toBeGreaterThanOrEqual(60);
        expect(ttlMinutes).toBeLessThanOrEqual(120);
    });

    it('returns 503 (not 500/200) when the demo identity is not seeded', async () => {
        dbMock.getUser.mockResolvedValueOnce(undefined);
        const res = await request(app).post('/api/auth/demo-login');
        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe('DEMO_UNAVAILABLE');
    });

    it('never returns an admin credential or password', async () => {
        const res = await request(app).post('/api/auth/demo-login');
        const body = JSON.stringify(res.body);
        expect(body).not.toMatch(/yme123|password|user_password/i);
    });
});

describe('token expiry', () => {
    it('an expired token is rejected by a protected route (401)', async () => {
        const expired = jwt.sign({ user_role: 'demo' }, config.jwtSecret, { expiresIn: -30 });
        const res = await request(app)
            .get('/api/chargesBy/NAO/20220101/20220131')
            .set('x-observatory-auth', expired);
        expect(res.status).toBe(401);
    });

    it('a token signed with the wrong secret is rejected (401)', async () => {
        const forged = jwt.sign({ user_role: 'admin' }, 'wrong-secret', { expiresIn: '1h' });
        const res = await request(app)
            .get('/api/chargesBy/NAO/20220101/20220131')
            .set('x-observatory-auth', forged);
        expect(res.status).toBe(401);
    });
});
