/*
 * Provider-neutral, one-time bootstrap helpers for an empty managed MySQL
 * database. Runtime startup never imports SQL; these helpers are only called
 * by the explicit npm scripts below.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

const REQUIRED_TABLES = ['Company', 'Debt', 'Passages', 'Toll', 'TotalDebts', 'Transceiver', 'users'];
const initDir = path.resolve(__dirname, '../../db/init');

function connectionOptions() {
  const { host, port, user, password, database, ssl } = config.db;
  return { host, port, user, password, database, ...(ssl ? { ssl } : {}), multipleStatements: true };
}

async function inspect(connection) {
  const [rows] = await connection.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`,
    [config.db.database]
  );
  const tables = rows.map((row) => row.TABLE_NAME || row.table_name).sort();
  return {
    tables,
    schemaReady: REQUIRED_TABLES.every((table) => tables.includes(table)),
    missingTables: REQUIRED_TABLES.filter((table) => !tables.includes(table)),
  };
}

function readInit(name) {
  return fs.readFileSync(path.join(initDir, name), 'utf8');
}

function managedSchema(source) {
  // The Docker-entrypoint dump contains an initial placeholder view and DROP
  // statements. An explicit managed deployment already proves the target is
  // empty, so neither is necessary. Strip the root-specific DEFINER too.
  return source
    .replace(/--\n-- Temporary view structure[\s\S]*?--\n-- Table structure for table `Company`/m, '--\n-- Table structure for table `Company`')
    .replace(/^DROP TABLE IF EXISTS `[^`]+`;\n/gm, '')
    .replace(/^\/\*!50001 DROP VIEW IF EXISTS `[^`]+`\*\/;\n/gm, '')
    .replace(/^\/\*!50013 DEFINER=.*?\*\/\n/gm, '');
}

function managedData(source) {
  // LOCK/ALTER TABLE directives are Docker-dump optimisations that commonly
  // require privileges not granted to a managed-db importer. FK checks remain
  // session-local so the original dump ordering stays valid.
  return source
    .replace(/^LOCK TABLES .*?;\n/gm, '')
    .replace(/^UNLOCK TABLES;\n/gm, '')
    .replace(/^\/\*!40000 ALTER TABLE .*?\*\/;\n/gm, '');
}

function bootstrapStatements() {
  return [
    managedSchema(readInit('01-schema.sql')),
    managedData(readInit('02-data.sql')),
    readInit('03-demo-account.sql'),
  ];
}

function assertConfirmed() {
  if (process.env.CONFIRM_DB_DEPLOY !== 'true') {
    const error = new Error('CONFIRMATION_REQUIRED');
    error.code = 'CONFIRMATION_REQUIRED';
    throw error;
  }
}

function assertEmpty(status) {
  if (status.tables.length > 0) {
    const error = new Error('DATABASE_NOT_EMPTY');
    error.code = 'DATABASE_NOT_EMPTY';
    throw error;
  }
}

async function deploySeed() {
  assertConfirmed();
  const connection = await mysql.createConnection(connectionOptions());
  try {
    const before = await inspect(connection);
    assertEmpty(before);
    for (const statement of bootstrapStatements()) await connection.query(statement);
    const after = await inspect(connection);
    if (!after.schemaReady) {
      const error = new Error('BOOTSTRAP_INCOMPLETE');
      error.code = 'BOOTSTRAP_INCOMPLETE';
      throw error;
    }
    return { schemaReady: true, tables: after.tables };
  } finally {
    await connection.end();
  }
}

module.exports = {
  REQUIRED_TABLES,
  assertConfirmed,
  assertEmpty,
  bootstrapStatements,
  connectionOptions,
  deploySeed,
  inspect,
  managedData,
  managedSchema,
};
