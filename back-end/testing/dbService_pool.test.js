const mockEnd = jest.fn().mockResolvedValue(undefined);
const mockQuery = jest.fn();
const mockCreatePool = jest.fn(() => ({ promise: () => ({ end: mockEnd, query: mockQuery }) }));

jest.mock('mysql2', () => ({ createPool: mockCreatePool }));

describe('shared MySQL pool', () => {
  it('creates one configured pool and closes it gracefully', async () => {
    let DbService;
    let config;
    jest.isolateModules(() => {
      DbService = require('../dbService');
      config = require('../config');
    });
    expect(mockCreatePool).toHaveBeenCalledTimes(1);
    expect(mockCreatePool).toHaveBeenCalledWith(expect.objectContaining({
      connectionLimit: config.db.connectionLimit,
      connectTimeout: config.db.connectTimeout,
      waitForConnections: true,
    }));
    await expect(DbService.closePool()).resolves.toBeUndefined();
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});
