const { query } = require('./pool');

exports.insert = async (userId, message, c) =>
  (await query('INSERT INTO notifications (user_id, message) VALUES ($1,$2) RETURNING *', [userId, message], c)).rows[0];

exports.list = async (userId, unreadOnly) =>
  (await query(
    `SELECT id, message, read, created_at FROM notifications WHERE user_id = $1 ${unreadOnly ? 'AND read = FALSE' : ''}
      ORDER BY created_at DESC, id DESC LIMIT 100`, [userId])).rows;

exports.unreadCount = async (userId) =>
  Number((await query('SELECT count(*) FROM notifications WHERE user_id = $1 AND read = FALSE', [userId])).rows[0].count);

exports.markRead = async (userId, id) =>
  (await query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [id, userId])).rowCount;

exports.markAllRead = (userId) => query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [userId]);

// ---- email outbox (retry queue) ----
exports.enqueueEmail = async (to, subject, body, c) =>
  (await query('INSERT INTO email_outbox (to_email, subject, body) VALUES ($1,$2,$3) RETURNING id', [to, subject, body], c)).rows[0];

exports.dueEmails = async (now, limit = 20) =>
  (await query(
    `SELECT * FROM email_outbox WHERE sent_at IS NULL AND next_attempt_at <= $1 AND attempts < 8
      ORDER BY id LIMIT $2`, [now, limit])).rows;

exports.markEmailSent = (id, now) => query('UPDATE email_outbox SET sent_at = $2, attempts = attempts + 1 WHERE id = $1', [id, now]);

exports.markEmailFailed = (id, attempts, nextAt) =>
  query('UPDATE email_outbox SET attempts = $2, next_attempt_at = $3 WHERE id = $1', [id, attempts, nextAt]);
