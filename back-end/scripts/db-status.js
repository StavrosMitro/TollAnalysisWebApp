#!/usr/bin/env node
/*
 * Read-only deployment preflight. It intentionally never creates a schema,
 * imports sample data, or changes a user. Use it before and after a manual,
 * one-time database initialization on a managed provider.
 */
const mysql = require('mysql2/promise');
const config = require('../config');

const REQUIRED_TABLES = ['Company', 'Debt', 'Passages', 'Toll', 'TotalDebts', 'Transceiver', 'users'];

async function main() {
    const connection = await mysql.createConnection(config.db);
    try {
        const [tableRows] = await connection.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = ? AND table_name IN (?)`,
            [config.db.database, REQUIRED_TABLES]
        );
        const tables = tableRows.map((row) => row.TABLE_NAME || row.table_name).sort();
        const missingTables = REQUIRED_TABLES.filter((table) => !tables.includes(table));
        let demoAccount = null;
        let passageCount = null;
        if (missingTables.length === 0) {
            const [demoRows] = await connection.query(
                'SELECT user_role FROM users WHERE user_email = ? LIMIT 1',
                [config.demo.email]
            );
            const [countRows] = await connection.query('SELECT COUNT(*) AS count FROM Passages');
            demoAccount = demoRows[0] && demoRows[0].user_role === 'demo';
            passageCount = Number(countRows[0].count);
        }
        const result = {
            database: config.db.database,
            schemaReady: missingTables.length === 0,
            missingTables,
            demoAccount,
            passageCount,
            action: missingTables.length === 0
                ? 'No changes made. Database looks compatible with this demo.'
                : 'No changes made. Run the reviewed one-time schema and fictional seed import explicitly.',
        };
        console.log(JSON.stringify(result));
        process.exitCode = result.schemaReady && result.demoAccount ? 0 : 2;
    } finally {
        await connection.end();
    }
}

main().catch((err) => {
    // The command is used in deployment logs; connection details never appear.
    console.error(JSON.stringify({ code: 'DATABASE_UNAVAILABLE', message: 'Could not inspect the database.' }));
    process.exitCode = 1;
});
