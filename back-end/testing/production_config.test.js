/** Production startup must fail closed for an unsafe public-demo combination. */
const path = require('path');
const { spawnSync } = require('child_process');

const backendRoot = path.join(__dirname, '..');
const secureJwt = '91f3a4c7e6d82b5f0a9c4e1b7d3f8a6c2e9b5d0f4a7c1e8b3d6f9a2c5e7b0d4f';

describe('production public-demo startup validation', () => {
    it.each([undefined, 'false', 'TRUE', 'true '])(
        'refuses PUBLIC_DEMO_MODE=true unless DISABLE_DESTRUCTIVE_OPS is exactly true (%p)',
        (disableDestructiveOps) => {
            const env = {
                ...process.env,
                NODE_ENV: 'production',
                PUBLIC_DEMO_MODE: 'true',
                JWT_SECRET: secureJwt,
                PASSWORD: 'dedicated-test-database-password',
                DUSER: 'toll_app',
                DATABASE: 'toll_analysis_test',
            };
            if (disableDestructiveOps === undefined) delete env.DISABLE_DESTRUCTIVE_OPS;
            else env.DISABLE_DESTRUCTIVE_OPS = disableDestructiveOps;

            const result = spawnSync(process.execPath, ['-e', "require('./config')"], {
                cwd: backendRoot,
                env,
                encoding: 'utf8',
            });

            expect(result.status).toBe(1);
            expect(result.stderr).toContain('PUBLIC_DEMO_MODE=true requires DISABLE_DESTRUCTIVE_OPS=true');
        }
    );
});
