const { createApp } = require('./app');
const config = require('./config');
const scheduler = require('./jobs/scheduler');
const logger = require('./utils/logger');
const { pool } = require('./dal/pool');

const app = createApp();
const server = app.listen(config.port, () => logger.info(`PeerLearn API listening on :${config.port}`));
const stopJobs = config.jobsEnabled ? scheduler.start() : () => {};

const shutdown = () => { stopJobs(); server.close(() => pool.end().then(() => process.exit(0))); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
