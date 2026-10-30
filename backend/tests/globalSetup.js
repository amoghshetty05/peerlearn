// Creates a fresh test database with the same schema and roles as production (Test Plan section 8).
const { Client } = require('pg');
const { migrate } = require('../scripts/migrate');

module.exports = async () => {
  const base = process.env.TEST_ADMIN_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
  const c = new Client({ connectionString: base });
  await c.connect();
  await c.query('DROP DATABASE IF EXISTS peerlearn_test WITH (FORCE)');
  await c.query('CREATE DATABASE peerlearn_test');
  await c.end();
  const adminUrl = base.replace(/\/[^/]*$/, '/peerlearn_test');
  process.env.TEST_DB_ADMIN_URL = adminUrl;
  await migrate({ adminUrl, appPassword: 'app_pw' });
};
