/**
 * @file get_figures_controller.test.js
 */

const request = require('supertest');
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Load .env from one folder up so that JWT_SECRET is available
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Mock DbService so no real DB calls occur.
jest.mock('../dbService.js', () => ({
  getDbServiceInstance: jest.fn().mockReturnValue({
    // Add method stubs if necessary
  }),
}));

// Mock fs so we don't actually read or check real files on disk.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

// Import the controller directly
const { get_figures } = require('../controllers/get_figures_controller');

describe('GET /figures (with format)', () => {
  let app;
  let token;

  beforeAll(() => {
    // Generate a valid JWT token using your secret and a payload.
    const payload = {
      username: 'admin@yme.gov.gr',
      user_role: 'admin'
    };
    const secret = process.env.JWT_SECRET || 'mySuperSecretKey';
    token = jwt.sign(payload, secret, { expiresIn: '1h' });

    // Create an Express app that uses our controller.
    app = express();
    app.get('/figures', get_figures);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 400 if the format query is invalid', async () => {
    // We pass a format that isn't 'csv' or 'json'
    const response = await request(app)
      .get('/figures?format=xml')
      .set('x-observatory-auth', token);
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Invalid format. Must be either "csv" or "json".');
  });

  test('should return 204 if any required file is missing', async () => {
    // The controller checks four files. If *any* is missing, it returns 204.
    // Suppose the first file check returns true, but the second returns false.
    fs.existsSync
      .mockReturnValueOnce(true)   // figure1
      .mockReturnValueOnce(false); // figure2 => triggers 204

    const response = await request(app)
      .get('/figures?format=json')
      .set('x-observatory-auth', token);

    expect(response.status).toBe(204);
    // No response body is expected for 204
    expect(response.text).toBe('');
  });

  test('should return 500 if reading the file throws an error', async () => {
    // All files exist
    fs.existsSync.mockReturnValue(true);

    // Throw an error during readFileSync
    fs.readFileSync.mockImplementation(() => {
      throw new Error('File read error');
    });

    const response = await request(app)
      .get('/figures?format=json')
      .set('x-observatory-auth', token);

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toEqual({
      code: 'FIGURES_UNAVAILABLE',
      message: 'The optimization figures are unavailable.',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/File read error|stack|path/i);
  });

  test('should return 200 and JSON data if format=json', async () => {
    // All files exist
    fs.existsSync.mockReturnValue(true);

    // Mock reading the .png files (base64) and .html files (utf-8)
    fs.readFileSync.mockImplementation((filePath, options) => {
      if (options.encoding === 'base64') {
        return 'fakeBase64data';
      } else if (options.encoding === 'utf-8') {
        return '<html>fakeHTML</html>';
      }
      return '';
    });

    const response = await request(app)
      .get('/figures?format=json')
      .set('x-observatory-auth', token);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Figures of initial debts and debts after the optimization');
    expect(response.body).toHaveProperty('figures');
    expect(response.body.figures.figure1).toContain('data:image/png;base64,fakeBase64data');
    expect(response.body.figures.figure2).toContain('data:image/png;base64,fakeBase64data');
    expect(response.body).toHaveProperty('html');
    expect(response.body.html.html1).toBe('<html>fakeHTML</html>');
    expect(response.body.html.html2).toBe('<html>fakeHTML</html>');
  });

  test('should return 200 and CSV data if format=csv', async () => {
    // All files exist
    fs.existsSync.mockReturnValue(true);

    // Mock reading the .png files (base64) and .html files (utf-8)
    fs.readFileSync.mockImplementation((filePath, options) => {
      if (options.encoding === 'base64') {
        return 'fakeBase64data';
      } else if (options.encoding === 'utf-8') {
        return '<html>fakeHTML</html>';
      }
      return '';
    });

    const response = await request(app)
      .get('/figures?format=csv')
      .set('x-observatory-auth', token);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');

    // The CSV is expected to have a header and one row:
    // message,figure1,figure2,html1,html2
    // "Figures of initial debts and debts after the optimization", "data:image/png;base64,fakeBase64data", ...
    const csvBody = response.text;
    expect(csvBody).toContain('message,figure1,figure2,html1,html2');
    expect(csvBody).toContain('"Figures of initial debts and debts after the optimization"');
    expect(csvBody).toContain('"data:image/png;base64,fakeBase64data"');
    expect(csvBody).toContain('<html>fakeHTML</html>');
  });
});
