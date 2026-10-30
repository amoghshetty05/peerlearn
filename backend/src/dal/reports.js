const { query } = require('./pool');

exports.create = async ({ reporterId, reportedId, reason }, c) =>
  (await query('INSERT INTO reports (reporter_id, reported_id, reason) VALUES ($1,$2,$3) RETURNING *',
    [reporterId, reportedId, reason], c)).rows[0];

exports.list = async (status) =>
  (await query(
    `SELECT r.*, rp.name AS reporter_name, rd.name AS reported_name, rd.status AS reported_status, rd.warnings AS reported_warnings
       FROM reports r JOIN users rp ON rp.id = r.reporter_id JOIN users rd ON rd.id = r.reported_id
      ${status ? 'WHERE r.status = $1' : ''} ORDER BY r.created_at DESC LIMIT 200`,
    status ? [status] : [])).rows;

exports.lockById = async (id, c) =>
  (await query('SELECT * FROM reports WHERE id = $1 FOR UPDATE', [id], c)).rows[0];

exports.resolve = async (id, status, adminId, now, c) =>
  (await query('UPDATE reports SET status = $2, resolved_by = $3, resolved_at = $4 WHERE id = $1 RETURNING *',
    [id, status, adminId, now], c)).rows[0];
