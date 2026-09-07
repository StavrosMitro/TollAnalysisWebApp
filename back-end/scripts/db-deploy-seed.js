#!/usr/bin/env node
const { deploySeed } = require('./db-deploy');

deploySeed()
  .then((result) => console.log(JSON.stringify({ status: 'seeded', tableCount: result.tables.length })))
  .catch((error) => {
    const code = error && error.code;
    const message = code === 'CONFIRMATION_REQUIRED'
      ? 'Set CONFIRM_DB_DEPLOY=true only after confirming that the target is the empty fictional-demo database.'
      : code === 'DATABASE_NOT_EMPTY'
        ? 'Bootstrap refuses to change a non-empty database.'
        : code === 'BOOTSTRAP_INCOMPLETE'
          ? 'Bootstrap did not create the expected schema; inspect the empty target and retry only after review.'
          : 'Bootstrap failed. The database may be partially initialized; inspect it before any retry.';
    console.error(JSON.stringify({ code: code || 'BOOTSTRAP_FAILED', message }));
    process.exitCode = 1;
  });
