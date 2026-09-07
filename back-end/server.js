const app = require('./app');
const config = require('./config');
const DbService = require('./dbService');

const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(
        `Toll Analysis backend listening on port ${config.port} (${config.nodeEnv})`
    );
});

function shutdown(signal) {
    console.log(JSON.stringify({ level: 'info', event: 'shutdown_started', signal }));
    server.close(async () => {
        try {
            await DbService.closePool();
        } catch (err) {
            console.error('[shutdown] database pool close failed:', err.message);
        }
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 25000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
