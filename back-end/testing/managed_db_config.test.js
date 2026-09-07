const path = require('path');
const { spawnSync } = require('child_process');

const backendRoot = path.join(__dirname, '..');
const secureJwt = '91f3a4c7e6d82b5f0a9c4e1b7d3f8a6c2e9b5d0f4a7c1e8b3d6f9a2c5e7b0d4f';
const password = 'managed-database-password-not-for-logs';
const base = {
  NODE_ENV: 'production',
  PUBLIC_DEMO_MODE: 'true',
  DISABLE_DESTRUCTIVE_OPS: 'true',
  JWT_SECRET: secureJwt,
  DATABASE_HOST: 'mysql.example.invalid',
  DATABASE_PORT: '3306',
  DATABASE_NAME: 'toll_analysis',
  DATABASE_USER: 'toll_runtime',
  DATABASE_PASSWORD: password,
};

function run(overrides = {}, expression = "require('./config')") {
  const env = { ...process.env, ...base, ...overrides };
  ['HOST', 'DB_PORT', 'DUSER', 'PASSWORD', 'DATABASE'].forEach((name) => delete env[name]);
  return spawnSync(process.execPath, ['-e', expression], { cwd: backendRoot, env, encoding: 'utf8' });
}

describe('managed MySQL configuration', () => {
  it('enables certificate-validated TLS from an in-memory base64 PEM', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nZmFrZS1jYQ==\n-----END CERTIFICATE-----\n';
    const result = run({ DATABASE_SSL: 'true', DATABASE_SSL_CA_BASE64: Buffer.from(pem).toString('base64') },
      "const c=require('./config'); console.log(JSON.stringify({ssl:c.db.ssl.rejectUnauthorized,ca:c.db.ssl.ca,limit:c.db.connectionLimit,timeout:c.db.connectTimeout}))");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ssl: true, ca: pem, limit: 3, timeout: 10000 });
  });

  it('keeps non-TLS local compatibility when TLS is false', () => {
    const result = run({ DATABASE_SSL: 'false' }, "const c=require('./config'); console.log(Boolean(c.db.ssl))");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('false');
  });

  it('uses the configured PORT and provider-safe all-interface binding', () => {
    const result = run({ DATABASE_SSL: 'false', PORT: '9123' },
      "const c=require('./config'); console.log(JSON.stringify({port:c.port,host:c.bindHost}))");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ port: 9123, host: '0.0.0.0' });
  });

  it.each([
    [{ DATABASE_SSL: 'true', DATABASE_SSL_CA_BASE64: '' }, 'DATABASE_SSL=true requires DATABASE_SSL_CA_BASE64'],
    [{ DATABASE_SSL: 'true', DATABASE_SSL_CA_BASE64: 'not-base64?' }, 'DATABASE_SSL_CA_BASE64 is not valid base64'],
    [{ DATABASE_CONNECTION_LIMIT: '0' }, 'DATABASE_CONNECTION_LIMIT must be an integer'],
    [{ DATABASE_CONNECT_TIMEOUT_MS: 'abc' }, 'DATABASE_CONNECT_TIMEOUT_MS must be an integer'],
  ])('fails closed without disclosing a password for invalid managed config', (overrides, expected) => {
    const result = run(overrides);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expected);
    expect(result.stderr).not.toContain(password);
    expect(result.stderr).not.toContain('mysql.example.invalid');
  });
});
