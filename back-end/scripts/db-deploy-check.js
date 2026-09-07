#!/usr/bin/env node
const mysql = require('mysql2/promise');
const { connectionOptions, inspect } = require('./db-deploy');

async function main() {
  const connection = await mysql.createConnection(connectionOptions());
  try {
    const status = await inspect(connection);
    console.log(JSON.stringify({
      databaseEmpty: status.tables.length === 0,
      schemaReady: status.schemaReady,
      missingTables: status.missingTables,
      action: status.tables.length === 0
        ? 'No changes made. Set CONFIRM_DB_DEPLOY=true only to seed this empty database.'
        : 'No changes made. Bootstrap refuses non-empty databases.',
    }));
    process.exitCode = status.tables.length === 0 || status.schemaReady ? 0 : 2;
  } finally {
    await connection.end();
  }
}

main().catch(() => {
  console.error(JSON.stringify({ code: 'DATABASE_UNAVAILABLE', message: 'Could not inspect the database.' }));
  process.exitCode = 1;
});
