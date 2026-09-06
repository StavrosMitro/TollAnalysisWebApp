// Integration tests: run the real Express app against a DISPOSABLE MySQL whose
// name ends in "_test". Serial (maxWorkers: 1) because some tests reset the DB.
// setup.integration.js refuses to run without the safety env vars.
module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/testing/setup.integration.js'],
    testMatch: ['<rootDir>/testing/integration/*.test.js'],
    maxWorkers: 1,
    testTimeout: 30000,
    clearMocks: true,
    passWithNoTests: true,
};
