const { query } = require('./pool');

const COLS = 'id, name, email, role, phone, status, warnings, created_at';

exports.findByEmail = async (email, c) =>
  (await query('SELECT * FROM users WHERE email = $1', [email], c)).rows[0];

exports.findById = async (id, c) =>
  (await query(`SELECT ${COLS} FROM users WHERE id = $1`, [id], c)).rows[0];

// Used by the auth middleware: user row + whether this token was revoked, in one round trip.
exports.findForToken = async (id, jti) =>
  (await query(
    `SELECT ${COLS}, EXISTS (SELECT 1 FROM revoked_tokens WHERE jti = $2) AS revoked
       FROM users WHERE id = $1`, [id, jti])).rows[0];

exports.create = async ({ name, email, passwordHash, role, phone }, c) =>
  (await query(
    `INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1,$2,$3,$4,$5)
     RETURNING ${COLS}`, [name, email, passwordHash, role, phone || null], c)).rows[0];

exports.updateProfile = async (id, { name, phone }, c) =>
  (await query(
    `UPDATE users SET name = COALESCE($2, name), phone = CASE WHEN $4 THEN $3 ELSE phone END
      WHERE id = $1 RETURNING ${COLS}`,
    [id, name ?? null, phone ?? null, phone !== undefined], c)).rows[0];

exports.recordFailedLogin = async (id, lockAfter, lockMinutes, now) =>
  (await query(
    `UPDATE users SET
        failed_logins = CASE WHEN locked_until IS NOT NULL AND locked_until <= $4 THEN 1 ELSE failed_logins + 1 END,
        locked_until  = CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= $4 THEN 1 ELSE failed_logins + 1 END) >= $2
                             THEN $4::timestamptz + make_interval(mins => $3) ELSE NULL END
      WHERE id = $1 RETURNING failed_logins, locked_until`,
    [id, lockAfter, lockMinutes, now])).rows[0];

exports.clearFailedLogins = (id) =>
  query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [id]);

exports.revokeToken = (jti, expiresAt) =>
  query('INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1,$2) ON CONFLICT DO NOTHING', [jti, expiresAt]);

exports.purgeRevoked = (now) => query('DELETE FROM revoked_tokens WHERE expires_at < $1', [now]);

exports.addWarning = (id, c) =>
  query('UPDATE users SET warnings = warnings + 1 WHERE id = $1', [id], c);

exports.suspend = (id, c) =>
  query("UPDATE users SET status = 'suspended' WHERE id = $1", [id], c);
