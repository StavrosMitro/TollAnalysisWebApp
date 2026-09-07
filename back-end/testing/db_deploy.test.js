const deploy = require('../scripts/db-deploy');

describe('managed database bootstrap safety', () => {
  it('uses the reviewed init sources while stripping Docker-only destructive directives', () => {
    const [schema, data, demo] = deploy.bootstrapStatements();
    expect(schema).toContain('CREATE TABLE `Company`');
    expect(schema).not.toMatch(/DROP (?:TABLE|VIEW)/i);
    expect(schema).not.toMatch(/DEFINER=/i);
    expect(data).toContain('INSERT INTO `Company`');
    expect(data).not.toMatch(/LOCK TABLES|DISABLE KEYS/i);
    expect(demo).toContain("demo@toll-analysis.example");
  });

  it('requires explicit confirmation and an empty database', () => {
    const prior = process.env.CONFIRM_DB_DEPLOY;
    delete process.env.CONFIRM_DB_DEPLOY;
    expect(() => deploy.assertConfirmed()).toThrow('CONFIRMATION_REQUIRED');
    process.env.CONFIRM_DB_DEPLOY = 'true';
    expect(() => deploy.assertEmpty({ tables: ['Company'] })).toThrow('DATABASE_NOT_EMPTY');
    expect(() => deploy.assertEmpty({ tables: [] })).not.toThrow();
    if (prior === undefined) delete process.env.CONFIRM_DB_DEPLOY;
    else process.env.CONFIRM_DB_DEPLOY = prior;
  });
});
