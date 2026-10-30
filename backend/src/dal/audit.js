const { query } = require('./pool');

exports.append = (userId, action, c) =>
  query('INSERT INTO audit_log (user_id, action) VALUES ($1,$2)', [userId ?? null, String(action).slice(0, 200)], c);

exports.list = async ({ userId, limit = 100 }) =>
  (await query(
    `SELECT id, user_id, action, timestamp FROM audit_log ${userId ? 'WHERE user_id = $1' : ''}
      ORDER BY id DESC LIMIT ${Number(limit) | 0}`, userId ? [userId] : [])).rows;
