/**
 * Integration smoke test - runs the REAL Express app against a DISPOSABLE
 * MySQL whose name ends in "_test" (see scripts/integration-db.sh).
 *
 * setup.integration.js refuses to run unless:
 *   NODE_ENV=test  &&  DATABASE=*_test  &&  ALLOW_DESTRUCTIVE_TESTS=true
 *
 * Covers: real DB connectivity, the public demo journey end-to-end, and the
 * invariant that the demo journey mutates nothing. The destructive-endpoint
 * tests run LAST (they wipe the disposable DB on purpose).
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const app = require('../../app');

const ML = process.env.INTEGRATION_ML === 'true'; // set when PYTHON_BIN has scikit-learn

async function rowCounts(adminToken) {
    const res = await request(app).get('/api/admin/healthcheck').set('x-observatory-auth', adminToken);
    return { n_stations: res.body.n_stations, n_tags: res.body.n_tags, n_passes: res.body.n_passes };
}

describe('integration: infrastructure', () => {
    it('GET /healthz -> 200 with a real DB', async () => {
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    });

    it('admin login works and healthcheck reports seeded counts', async () => {
        const login = await request(app)
            .post('/api/login')
            .send({ user_email: 'admin@yme.gov.gr', user_password: 'yme123!' });
        expect(login.status).toBe(200);
        const hc = await request(app)
            .get('/api/admin/healthcheck')
            .set('x-observatory-auth', login.body.token);
        expect(hc.status).toBe(200);
        expect(hc.body.n_passes).toBeGreaterThan(0);
        expect(hc.body.n_stations).toBeGreaterThan(0);
    });
});

describe('integration: public demo journey (read-only, no mutations)', () => {
    let demoToken;
    let before;

    beforeAll(async () => {
        const adminLogin = await request(app)
            .post('/api/login')
            .send({ user_email: 'admin@yme.gov.gr', user_password: 'yme123!' });
        before = await rowCounts(adminLogin.body.token);

        const res = await request(app).post('/api/auth/demo-login');
        expect(res.status).toBe(200);
        demoToken = res.body.token;
        expect(jwt.decode(demoToken).user_role).toBe('demo');
    });

    it('demo can read public map data', async () => {
        expect((await request(app).get('/api/tolls')).status).toBe(200);
    });

    it('demo can read analytics', async () => {
        const res = await request(app)
            .get('/api/chargesBy/NAO/20220101/20221231')
            .set('x-observatory-auth', demoToken);
        expect([200, 204]).toContain(res.status);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });

    (ML ? it : it.skip)('demo can read a forecast', async () => {
        const res = await request(app)
            .get('/api/forecast/NAO/20220115')
            .set('x-observatory-auth', demoToken);
        expect([200, 204]).toContain(res.status);
    });

    it.each([
        ['POST', '/api/training'],
        ['PUT', '/api/passing_toll'],
        ['POST', '/api/upload_passages'],
        ['POST', '/api/admin/resetpasses'],
        ['POST', '/api/admin/resetstations'],
        ['PATCH', '/api/cancel_debts'],
        ['GET', '/api/admin/users'],
    ])('demo is DENIED from %s %s', async (method, path) => {
        const res = await request(app)[method.toLowerCase()](path).set('x-observatory-auth', demoToken);
        expect(res.status).toBe(403);
    });

    it('row counts are UNCHANGED after the whole demo journey', async () => {
        const adminLogin = await request(app)
            .post('/api/login')
            .send({ user_email: 'admin@yme.gov.gr', user_password: 'yme123!' });
        const after = await rowCounts(adminLogin.body.token);
        expect(after).toEqual(before);
    });
});

describe('integration: cross-company access (real DB)', () => {
    let neaodosToken; // operator NO

    beforeAll(async () => {
        const login = await request(app)
            .post('/api/login')
            .send({ user_email: 'admin@neaodos.gr', user_password: 'Neaodos123!' });
        expect(login.status).toBe(200);
        neaodosToken = login.body.token;
    });

    it('DOCUMENTED current behaviour: a company user CAN read another operator\'s figures', async () => {
        delete process.env.ENFORCE_COMPANY_SCOPE;
        const own = await request(app).get('/api/chargesBy/NO/20220101/20221231').set('x-observatory-auth', neaodosToken);
        const other = await request(app).get('/api/chargesBy/AM/20220101/20221231').set('x-observatory-auth', neaodosToken);
        expect([200, 204]).toContain(own.status);
        expect([200, 204]).toContain(other.status); // <-- not isolated by default
        expect(other.status).not.toBe(403);
    });

    it('with ENFORCE_COMPANY_SCOPE=true, the same cross-operator request is 403', async () => {
        process.env.ENFORCE_COMPANY_SCOPE = 'true';
        try {
            const other = await request(app).get('/api/chargesBy/AM/20220101/20221231').set('x-observatory-auth', neaodosToken);
            expect(other.status).toBe(403);
            expect(other.body.error.code).toBe('COMPANY_SCOPE_RESTRICTION');
            const own = await request(app).get('/api/chargesBy/NO/20220101/20221231').set('x-observatory-auth', neaodosToken);
            expect([200, 204]).toContain(own.status);
        } finally {
            delete process.env.ENFORCE_COMPANY_SCOPE;
        }
    });
});

// LAST: prove the destructive endpoints still work for admin when the switch is
// off. These intentionally mutate the disposable DB.
describe('integration: destructive endpoints work for admin (switch off)', () => {
    let adminToken;
    beforeAll(async () => {
        process.env.DISABLE_DESTRUCTIVE_OPS = 'false';
        const login = await request(app)
            .post('/api/login')
            .send({ user_email: 'admin@yme.gov.gr', user_password: 'yme123!' });
        adminToken = login.body.token;
    });

    it('POST /api/admin/resetpasses -> 200 and actually clears passages', async () => {
        const res = await request(app).post('/api/admin/resetpasses').set('x-observatory-auth', adminToken);
        expect(res.status).toBe(200);
        const hc = await request(app).get('/api/admin/healthcheck').set('x-observatory-auth', adminToken);
        // Debt+Passages cleared by resetPasses
        expect(hc.body.n_passes).toBe(0);
    });
});
