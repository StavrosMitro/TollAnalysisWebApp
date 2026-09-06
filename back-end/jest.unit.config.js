// Unit tests: fully isolated, no database, no Python, no network.
module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/testing/setup.unit.js'],
    testMatch: ['<rootDir>/testing/*.test.js'],
    clearMocks: true,
};
