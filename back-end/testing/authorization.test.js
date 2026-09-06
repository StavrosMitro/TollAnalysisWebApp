/**
 * Backend enforcement of the authorization matrix (docs/AUTHORIZATION.md).
 * Frontend hiding is NOT authorization - these tests hit the real routers with
 * a mocked database / Python so every allow / deny decision is exercised.
 *
 *  role groups: visitor (no token) | demo | company | admin
 */
const request = require('supertest');

jest.mock('../dbService.js');
jest.mock('child_process', () => ({
    // spawn -> a fake process that immediately succeeds with a small JSON array
    spawn: jest.fn(() => ({
        stdout: { on: (e, cb) => { if (e === 'data') cb(JSON.stringify([{ passage_date: '2022-01-01', predicted: 1 }])); } },
        stderr: { on: jest.fn() },
        on: (e, cb) => { if (e === 'close') cb(0); },
    })),
    // exec -> callback-style; always call the callback so promisify(exec) resolves
    exec: jest.fn((cmd, optsOrCb, maybeCb) => {
        const cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
        if (cb) cb(null, { stdout: '', stderr: '' });
    }),
}));

const DbService = require('../dbService.js');

// A DB that answers everything plausibly (so "allowed" requests don't 500 for
// unrelated reasons).
const dbMock = {
    ping: jest.fn(async () => true),
    getUser: jest.fn(async () => ({ user_email: 'x', user_role: 'demo' })),
    getLastPassageId: jest.fn(async () => 0),
    getRecordsBetweenIds: jest.fn(async () => []),
    getDebtBetween2companies: jest.fn(async () => [{ nPasses: 1, passesCost: 1 }]),
    getpassAnalysis: jest.fn(async () => [{ passID: 1, stationID: 'NAO01', timestamp: new Date().toISOString(), tagID: 't', passCharge: 1 }]),
    getPassesBetween2companies: jest.fn(async () => ({ nPasses: 1, passesCost: 1 })),
    getRecordsBetweenDate: jest.fn(async () => [{ passage_id: 1, timestamp: new Date().toISOString(), tollID: 'NAO01', tagRef: 'x', tagHomeID: 'NAO', charge: 1 }]),
    tollstations: jest.fn(async () => [{ Toll_id: 'NAO01' }]),
    data_for_nop: jest.fn(async () => [{ tollID: 'NAO01', date: '2022-01-01', total_passages: 5 }]),
    data_for_peak_hour: jest.fn(async () => [{ passage_date: '2022-01-01', hour: 8, OpID: 'NAO', passage_count: 3 }]),
    peak_input_data: jest.fn(async () => [[{ passage_date: '2022-01-01', company: 'NAO' }]]),
    getAllUsers: jest.fn(async () => [{ user_id: 1, user_email: 'a@b.example', user_role: 'admin' }]),
    getDatabaseStats: jest.fn(async () => ({ n_stations: 1, n_tags: 1, n_passes: 1 })),
    resetPasses: jest.fn(async () => {}),
    initializeAdminAccount: jest.fn(async () => {}),
    resetTollStations: jest.fn(async () => {}),
};
DbService.getDbServiceInstance.mockReturnValue(dbMock);

const app = require('../app');
const { tokens } = require('./helpers/tokens');

const H = (t) => (t ? { 'x-observatory-auth': t } : {});

// [ method, path, body ]
const ANALYTICS = ['get', '/api/chargesBy/NAO/20220101/20220131'];
const FORECAST = ['get', '/api/forecast/NAO/20220115'];
const TRAINING = ['post', '/api/training'];
const UPLOAD = ['put', '/api/passing_toll'];
const RESET = ['post', '/api/admin/resetpasses'];
const CANCEL_DEBTS = ['patch', '/api/cancel_debts'];
const USER_ADMIN = ['get', '/api/admin/users'];

function call([method, path], token) {
    return request(app)[method](path).set(H(token));
}

describe('Health + public map data - everyone', () => {
    it.each([
        ['visitor', undefined],
        ['demo', tokens.demo()],
        ['company', tokens.company()],
        ['admin', tokens.admin()],
    ])('%s can read /healthz', async (_name, tok) => {
        const res = await request(app).get('/healthz').set(H(tok));
        expect([200, 503]).toContain(res.status); // never 401/403
    });

    it.each([
        ['visitor', undefined],
        ['demo', tokens.demo()],
    ])('%s can read /api/tolls (intentionally public)', async (_name, tok) => {
        const res = await request(app).get('/api/tolls').set(H(tok));
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });
});

describe('Read analytics + forecasts', () => {
    it('visitor is DENIED (401)', async () => {
        expect((await call(ANALYTICS)).status).toBe(401);
        expect((await call(FORECAST)).status).toBe(401);
    });
    it('demo is ALLOWED', async () => {
        expect((await call(ANALYTICS, tokens.demo())).status).toBe(200);
        expect([200, 204]).toContain((await call(FORECAST, tokens.demo())).status);
    });
    it('company is ALLOWED', async () => {
        expect((await call(ANALYTICS, tokens.company())).status).toBe(200);
    });
    it('admin is ALLOWED', async () => {
        expect((await call(ANALYTICS, tokens.admin())).status).toBe(200);
    });
});

describe('Destructive / privileged operations', () => {
    const dangerous = [
        ['training', TRAINING],
        ['upload/import', UPLOAD],
        ['reset', RESET],
        ['cancel debts', CANCEL_DEBTS],
        ['user administration', USER_ADMIN],
    ];

    describe('with DISABLE_DESTRUCTIVE_OPS=true (public demo mode)', () => {
        beforeAll(() => { process.env.DISABLE_DESTRUCTIVE_OPS = 'true'; });

        it.each(dangerous)('visitor DENIED from %s (401)', async (_n, ep) => {
            expect((await call(ep)).status).toBe(401);
        });
        it.each(dangerous)('demo DENIED from %s (403, never runs)', async (_n, ep) => {
            const res = await call(ep, tokens.demo());
            expect(res.status).toBe(403);
        });
        it.each(dangerous)('company DENIED from %s (403)', async (_n, ep) => {
            expect((await call(ep, tokens.company())).status).toBe(403);
        });
        it.each(dangerous)('admin DENIED from %s with DEMO_MODE_RESTRICTION (403)', async (_n, ep) => {
            const res = await call(ep, tokens.admin());
            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('DEMO_MODE_RESTRICTION');
        });
    });

    describe('with DISABLE_DESTRUCTIVE_OPS=false', () => {
        beforeAll(() => { process.env.DISABLE_DESTRUCTIVE_OPS = 'false'; });
        afterAll(() => { process.env.DISABLE_DESTRUCTIVE_OPS = 'true'; });

        it.each(dangerous)('demo is STILL DENIED from %s (403) - flag does not grant demo anything', async (_n, ep) => {
            expect((await call(ep, tokens.demo())).status).toBe(403);
        });
        it.each(dangerous)('company is STILL DENIED from %s (403)', async (_n, ep) => {
            expect((await call(ep, tokens.company())).status).toBe(403);
        });
        it.each(dangerous)('admin is NOT blocked by the demo restriction on %s', async (_n, ep) => {
            const res = await call(ep, tokens.admin());
            expect(res.status).not.toBe(401);
            // may be 200/204/207/500 depending on mocks, but NOT the demo 403
            if (res.status === 403) {
                expect(res.body.error && res.body.error.code).not.toBe('DEMO_MODE_RESTRICTION');
            }
        });
    });
});

describe('company-data scope (ENFORCE_COMPANY_SCOPE)', () => {
    const neaodos = tokens.company('neaodos'); // owns operator NO
    const aodos = tokens.company('aodos'); // ambiguous -> unmapped

    describe('default (flag OFF) - current API behaviour is permissive', () => {
        beforeAll(() => { delete process.env.ENFORCE_COMPANY_SCOPE; });
        it('a company user CAN read another operator\'s analytics (documented)', async () => {
            const res = await request(app)
                .get('/api/chargesBy/AM/20220101/20220131')
                .set(H(neaodos));
            expect(res.status).toBe(200);
        });
    });

    describe('flag ON', () => {
        beforeAll(() => { process.env.ENFORCE_COMPANY_SCOPE = 'true'; });
        afterAll(() => { delete process.env.ENFORCE_COMPANY_SCOPE; });

        it('company user reading their OWN operator is allowed', async () => {
            const res = await request(app).get('/api/chargesBy/NO/20220101/20220131').set(H(neaodos));
            expect(res.status).toBe(200);
        });
        it('company user reading ANOTHER operator -> 403 COMPANY_SCOPE_RESTRICTION', async () => {
            const res = await request(app).get('/api/chargesBy/AM/20220101/20220131').set(H(neaodos));
            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('COMPANY_SCOPE_RESTRICTION');
        });
        it('company user reading another operator\'s raw station passes -> 403', async () => {
            const res = await request(app).get('/api/tollStationPasses/AM01/20220101/20220131').set(H(neaodos));
            expect(res.status).toBe(403);
        });
        it('an unmapped role (aodos) fails closed -> 403', async () => {
            const res = await request(app).get('/api/chargesBy/NO/20220101/20220131').set(H(aodos));
            expect(res.status).toBe(403);
        });
        it('admin is unaffected by the scope flag', async () => {
            const res = await request(app).get('/api/chargesBy/AM/20220101/20220131').set(H(tokens.admin()));
            expect(res.status).toBe(200);
        });
        it('demo (platform-wide observer) is unaffected by the scope flag', async () => {
            const res = await request(app).get('/api/chargesBy/AM/20220101/20220131').set(H(tokens.demo()));
            expect(res.status).toBe(200);
        });
    });
});

describe('role escalation is impossible via token payload', () => {
    it('a token claiming an unknown role is denied on analytics', async () => {
        const weird = require('jsonwebtoken').sign(
            { user_role: 'superadmin' },
            require('../config').jwtSecret,
            { expiresIn: '1h' }
        );
        expect((await call(ANALYTICS, weird)).status).toBe(403);
    });
});
