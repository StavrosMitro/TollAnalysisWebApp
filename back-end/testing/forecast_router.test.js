/**
 * /api/forecast — passage-volume forecast route.
 * DB and the Python inference bridge are mocked; no real model runs.
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

jest.mock('../dbService.js', () => ({ getDbServiceInstance: jest.fn() }));
jest.mock('../lib/mlInference', () => {
  class InferenceError extends Error {
    constructor(code, message, httpStatus = 500) {
      super(message);
      this.code = code;
      this.httpStatus = httpStatus;
    }
  }
  return { forecastVolume: jest.fn(), predictPeakHours: jest.fn(), InferenceError };
});

const DbService = require('../dbService.js');
const { forecastVolume, InferenceError } = require('../lib/mlInference');
const forecastRouter = require('../routers/forecast_router');

const db = { tollstations: jest.fn() };
DbService.getDbServiceInstance.mockReturnValue(db);

const app = express();
app.use(express.json());
app.use('/api/forecast', forecastRouter);

let token;
beforeAll(() => {
  token = jwt.sign({ user_email: 'admin@yme.gov.gr', user_role: 'admin' },
    process.env.JWT_SECRET || 'mySuperSecretKey', { expiresIn: '1h' });
});
beforeEach(() => jest.clearAllMocks());

const OK_RESULT = {
  task: 'passage_volume', operator: 'NAO', date: '2022-03-15',
  predictions: [0.3, 0.4],
  stations: [
    { tollID: 'NAO01', predicted_passages: 0.3, station_seen_in_training: true },
    { tollID: 'NAO02', predicted_passages: 0.4, station_seen_in_training: true },
  ],
  total_predicted_passages: 0.7,
  model: { artifact_version: 'v2', train_date_range: { min: '2021-12-31', max: '2022-01-10' } },
  evaluation: { test_mae: 0.27, sanity_check_baseline: { name: "per_station_mean", test_mae: 0.28 } },
  limitations: 'educational sample',
};

describe('GET /api/forecast/:company_id/:date', () => {
  it('400 when the date is missing', async () => {
    const res = await request(app).get('/api/forecast/NAO').set('x-observatory-auth', token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_PARAMS');
  });

  it('400 on a non-YYYYMMDD date', async () => {
    const res = await request(app).get('/api/forecast/NAO/2022-03-15').set('x-observatory-auth', token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_DATE');
    expect(forecastVolume).not.toHaveBeenCalled();
  });

  it('404 when the operator has no toll stations', async () => {
    db.tollstations.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/forecast/ZZ/20220315').set('x-observatory-auth', token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('UNKNOWN_OPERATOR');
    expect(forecastVolume).not.toHaveBeenCalled();
  });

  it('surfaces a missing/incompatible model artifact as 503', async () => {
    db.tollstations.mockResolvedValueOnce([{ Toll_id: 'NAO01' }]);
    forecastVolume.mockRejectedValueOnce(new InferenceError('MODEL_UNAVAILABLE', 'model artifact not found', 503));
    const res = await request(app).get('/api/forecast/NAO/20220315').set('x-observatory-auth', token);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('MODEL_UNAVAILABLE');
  });

  it('200 with predictions + model + evaluation on success', async () => {
    db.tollstations.mockResolvedValueOnce([{ Toll_id: 'NAO01' }, { Toll_id: 'NAO02' }]);
    forecastVolume.mockResolvedValueOnce(OK_RESULT);
    const res = await request(app).get('/api/forecast/NAO/20220315').set('x-observatory-auth', token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.predictions)).toBe(true);
    expect(res.body.predictions).toHaveLength(2);
    expect(res.body.model.artifact_version).toBe('v2');
    expect(res.body.evaluation).toHaveProperty('sanity_check_baseline');
    expect(JSON.stringify(res.body)).not.toMatch(/beats_baseline/);
    expect(forecastVolume).toHaveBeenCalledWith('NAO', '2022-03-15', ['NAO01', 'NAO02']);
  });

  it('200 + text/csv when format=csv', async () => {
    db.tollstations.mockResolvedValueOnce([{ Toll_id: 'NAO01' }]);
    forecastVolume.mockResolvedValueOnce(OK_RESULT);
    const res = await request(app).get('/api/forecast/NAO/20220315?format=csv').set('x-observatory-auth', token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toMatch(/tollID/);
  });
});
