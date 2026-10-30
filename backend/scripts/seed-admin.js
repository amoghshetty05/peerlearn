// Creates the first Admin from ADMIN_EMAIL / ADMIN_PASSWORD (Admins cannot self-register).
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function seedAdmin({ adminUrl, email, password, name = 'PeerLearn Admin' }) {
  const c = new Client({ connectionString: adminUrl });
  await c.connect();
  try {
    const hash = await bcrypt.hash(password, 12);
    await c.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'admin')
       ON CONFLICT (email) DO NOTHING`, [name, email.toLowerCase(), hash]);
  } finally { await c.end(); }
}
module.exports = { seedAdmin };

if (require.main === module) {
  const { DATABASE_ADMIN_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!DATABASE_ADMIN_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('Set DATABASE_ADMIN_URL, ADMIN_EMAIL, ADMIN_PASSWORD'); process.exit(1); }
  seedAdmin({ adminUrl: DATABASE_ADMIN_URL, email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    .then(() => console.log(`Admin ${ADMIN_EMAIL} ready`)).catch((e) => { console.error(e); process.exit(1); });
}
