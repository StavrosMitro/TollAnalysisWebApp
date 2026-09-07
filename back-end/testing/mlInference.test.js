const { EventEmitter } = require('events');

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('../config', () => ({
  pythonBin: 'python3',
  paths: { backendRoot: '/tmp/toll-analysis' },
  inference: {
    maxConcurrent: 1,
    timeoutMs: 20,
    threadEnv: { OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', NUMEXPR_NUM_THREADS: '1' },
  },
}));

const { spawn } = require('child_process');
const { forecastVolume, InferenceError } = require('../lib/mlInference');

function child() {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  return proc;
}

describe('ML subprocess limits', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => jest.useRealTimers());

  it('returns a stable busy response while one inference owns the only slot', async () => {
    const proc = child();
    spawn.mockReturnValueOnce(proc);
    const first = forecastVolume('NAO', '2022-01-14', ['NAO01']);
    await expect(forecastVolume('NAO', '2022-01-14', ['NAO01']))
      .rejects.toMatchObject({ code: 'ENGINE_BUSY', httpStatus: 503 });
    proc.stdout.emit('data', Buffer.from('{"task":"passage_volume"}\n'));
    proc.emit('close', 0);
    await expect(first).resolves.toMatchObject({ task: 'passage_volume' });
  });

  it('terminates and reaps a timed-out process before releasing its slot', async () => {
    const proc = child();
    spawn.mockReturnValueOnce(proc);
    const pending = forecastVolume('NAO', '2022-01-14', ['NAO01']);
    jest.advanceTimersByTime(20);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    await expect(forecastVolume('NAO', '2022-01-14', ['NAO01']))
      .rejects.toMatchObject({ code: 'ENGINE_BUSY', httpStatus: 503 });
    proc.emit('close', null);
    await expect(pending).rejects.toBeInstanceOf(InferenceError);
    await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT', httpStatus: 504 });
  });
});
