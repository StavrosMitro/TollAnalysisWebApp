/**
 * Request-path bridge to the Python ML inference module (`python -m ml.infer`).
 *
 * - never trains: `ml.infer` only loads committed, versioned artifacts;
 * - returns the parsed JSON object on success;
 * - throws an { code, message, httpStatus } shaped error otherwise, with no
 *   filesystem paths or stack traces leaking to the caller.
 */
const { spawn } = require('child_process');
const config = require('../config');

let activeProcesses = 0;

class InferenceError extends Error {
    constructor(code, message, httpStatus = 500) {
        super(message);
        this.name = 'InferenceError';
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

function runInfer(args) {
    return new Promise((resolve, reject) => {
        if (activeProcesses >= config.inference.maxConcurrent) {
            reject(new InferenceError('ENGINE_BUSY', 'The prediction engine is busy. Please try again shortly.', 503));
            return;
        }
        activeProcesses += 1;
        let settled = false;
        const finish = (callback) => {
            if (settled) return;
            settled = true;
            activeProcesses -= 1;
            callback();
        };
        const proc = spawn(config.pythonBin, ['-m', 'ml.infer', ...args], {
            cwd: config.paths.backendRoot,
            env: { ...process.env, PYTHONPATH: config.paths.backendRoot, PYTHONDONTWRITEBYTECODE: '1' },
        });

        let out = '';
        let err = '';
        const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            finish(() => reject(new InferenceError('TIMEOUT', 'The prediction took too long.', 504)));
        }, config.inference.timeoutMs);

        proc.stdout.on('data', (d) => { if (out.length < 1024 * 1024) out += d.toString(); });
        proc.stderr.on('data', (d) => { if (err.length < 1024 * 1024) err += d.toString(); });

        proc.on('error', () => {
            clearTimeout(timer);
            finish(() => reject(new InferenceError('ENGINE_UNAVAILABLE', 'The prediction engine is not available.', 503)));
        });

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (settled) return;
            let parsed;
            try {
                parsed = JSON.parse(out.trim().split('\n').filter(Boolean).pop() || '{}');
            } catch (e) {
                if (err) console.error('[mlInference] non-JSON output:', err.slice(0, 300));
                return finish(() => reject(new InferenceError('BAD_OUTPUT', 'The prediction engine returned an unexpected result.', 502)));
            }
            if (parsed && parsed.error) {
                const { code: c, message: m } = parsed.error;
                return finish(() => reject(new InferenceError(c || 'INFERENCE_FAILED', m || 'Prediction failed.',
                    parsed.http_status || (code === 0 ? 422 : 500))));
            }
            if (code !== 0) {
                if (err) console.error('[mlInference] exit', code, err.slice(0, 300));
                return finish(() => reject(new InferenceError('INFERENCE_FAILED', 'Prediction failed.', 500)));
            }
            return finish(() => resolve(parsed));
        });
    });
}

/**
 * @param {string} operator  e.g. "NAO"
 * @param {string} date      "YYYY-MM-DD"
 * @param {string[]} stations toll station ids for this operator
 */
function forecastVolume(operator, date, stations) {
    return runInfer(['volume', '--operator', operator, '--date', date, '--stations', stations.join(',')]);
}

/**
 * @param {string} operator
 * @param {string} from  "YYYY-MM-DD"
 * @param {string} to    "YYYY-MM-DD"
 */
function predictPeakHours(operator, from, to) {
    return runInfer(['peak', '--operator', operator, '--from', from, '--to', to]);
}

module.exports = { forecastVolume, predictPeakHours, InferenceError };
