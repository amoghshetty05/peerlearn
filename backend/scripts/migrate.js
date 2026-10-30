// Applies db/schema.sql as the admin user, then creates the restricted application role (SR-07).
// The app role can INSERT and SELECT audit_log but never UPDATE or DELETE it.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function migrate({ adminUrl, appRole = 'peerlearn_app', appPassword }) {
  if (!appPassword) throw new Error('APP_DB_PASSWORD is required');
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8'));
    const role = client.escapeIdentifier(appRole);
    const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appRole]);
    const pw = client.escapeLiteral(appPassword);
    await client.query(exists.rowCount ? `ALTER ROLE ${role} LOGIN PASSWORD ${pw}` : `CREATE ROLE ${role} LOGIN PASSWORD ${pw}`);
    const db = client.escapeIdentifier((await client.query('SELECT current_database() AS d')).rows[0].d);
    await client.query(`GRANT CONNECT ON DATABASE ${db} TO ${role}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await client.query(`REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM ${role}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
  } finally {
    await client.end();
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate({ adminUrl: process.env.DATABASE_ADMIN_URL, appPassword: process.env.APP_DB_PASSWORD })
    .then(() => console.log('Migration complete'))
    .catch((e) => { console.error(e); process.exit(1); });
}
