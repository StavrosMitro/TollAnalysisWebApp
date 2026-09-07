/**
 * /api/peak_hour — peak-hour prediction route (the real router this time).
 * The Python inference bridge is mocked; no real model runs.
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

const { predictPeakHours, InferenceError } = require('../lib/mlInference');
const peakRouter = require('../routers/peak_hour_router');

const app = express();
app.use(express.json());
app.use('/api/peak_hour', peakRouter);

let token;
beforeAll(() => {
  token = jwt.sign({ user_email: 'admin@yme.gov.gr', user_role: 'admin' },
    process.env.JWT_SECRET || 'mySuperSecretKey', { expiresIn: '1h' });
});
beforeEach(() => jest.clearAllMocks());

const OK_RESULT = {
  task: 'peak_hour', operator: 'NAO',
  predictions: [
    { passage_date: '2022-01-13', company: 'NAO', predicted_hour: 0 },
    { passage_date: '2022-01-14', company: 'NAO', predicted_hour: 12 },
  ],
  model: { artifact_version: 'v2' },
  evaluation: { within_1_hour_accuracy: 0.5, mean_circular_abs_error_hours: 3.0, sanity_check_baseline: { name: "global_peak_hour_mode" } },
  limitations: 'very sparse sample',
};

describe('GET /api/peak_hour/:company_id/:DateFrom/:DateTo', () => {
  it('400 when a date is missing', async () => {
    const res = await request(app).get('/api/peak_hour/NAO/20220113').set('x-observatory-auth', token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_PARAMS');
  });

  it('400 on a non-YYYYMMDD date', async () => {
    const res = await request(app).get('/api/peak_hour/NAO/2022-01-13/20220114').set('x-observatory-auth', token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_DATE');
    expect(predictPeakHours).not.toHaveBeenCalled();
  });

  it('propagates an inference error status (e.g. unknown operator -> 400)', async () => {
    predictPeakHours.mockRejectedValueOnce(new InferenceError('UNKNOWN_OPERATOR', "operator 'ZZ' is not supported", 400));
    const res = await request(app).get('/api/peak_hour/ZZ/20220113/20220114').set('x-observatory-auth', token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_OPERATOR');
  });

  it('200 with an integer-hour predictions array + model + evaluation', async () => {
    predictPeakHours.mockResolvedValueOnce(OK_RESULT);
    const res = await request(app).get('/api/peak_hour/NAO/20220113/20220114').set('x-observatory-auth', token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.predictions)).toBe(true);
    res.body.predictions.forEach((p) => {
      expect(Number.isInteger(p.predicted_hour)).toBe(true);
      expect(p.predicted_hour).toBeGreaterThanOrEqual(0);
      expect(p.predicted_hour).toBeLessThanOrEqual(23);
    });
    expect(res.body.model.artifact_version).toBe('v2');
    expect(res.body.evaluation).toHaveProperty('mean_circular_abs_error_hours');
    expect(predictPeakHours).toHaveBeenCalledWith('NAO', '2022-01-13', '2022-01-14');
  });
});
