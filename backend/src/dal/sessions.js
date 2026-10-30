const { query } = require('./pool');

const JOINED = `
  SELECT s.*, hr.subject, hr.topic,
         l.name AS learner_name, l.email AS learner_email, l.phone AS learner_phone,
         t.name AS tutor_name, t.email AS tutor_email, t.phone AS tutor_phone,
         (rt.id IS NOT NULL) AS rated`;
const FROM = `
  FROM sessions s
  JOIN help_requests hr ON hr.id = s.request_id
  JOIN users l ON l.id = s.learner_id
  JOIN users t ON t.id = s.tutor_id
  LEFT JOIN ratings rt ON rt.session_id = s.id`;

exports.insert = async ({ requestId, learnerId, tutorId, slotTime, expiresAt }, c) =>
  (await query(
    `INSERT INTO sessions (request_id, learner_id, tutor_id, slot_time, expires_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`, [requestId, learnerId, tutorId, slotTime, expiresAt], c)).rows[0];

exports.findById = async (id, c) =>
  (await query(`${JOINED} ${FROM} WHERE s.id = $1`, [id], c)).rows[0];

exports.lockById = async (id, c) =>
  (await query('SELECT * FROM sessions WHERE id = $1 FOR UPDATE', [id], c)).rows[0];

exports.setStatus = async (id, status, now, c) =>
  (await query('UPDATE sessions SET status = $2, responded_at = $3 WHERE id = $1 RETURNING *', [id, status, now], c)).rows[0];

exports.duplicateExists = async (requestId, tutorId, c) =>
  (await query(
    `SELECT 1 FROM sessions WHERE request_id = $1 AND tutor_id = $2 AND status IN ('pending','accepted') LIMIT 1`,
    [requestId, tutorId], c)).rowCount > 0;

exports.tutorBusyAt = async (tutorId, slotTime, c) =>
  (await query(
    `SELECT 1 FROM sessions WHERE tutor_id = $1 AND slot_time = $2 AND status = 'accepted' LIMIT 1`,
    [tutorId, slotTime], c)).rowCount > 0;

exports.listForUser = async (userId, role, status) => {
  const col = role === 'tutor' ? 's.tutor_id' : 's.learner_id';
  const params = [userId];
  let where = `${col} = $1`;
  if (status) { params.push(status); where += ` AND s.status = $2`; }
  return (await query(`${JOINED} ${FROM} WHERE ${where} ORDER BY s.slot_time DESC LIMIT 100`, params)).rows;
};

exports.upcomingAccepted = async (userId, role, now) => {
  const col = role === 'tutor' ? 's.tutor_id' : 's.learner_id';
  return (await query(
    `${JOINED} ${FROM} WHERE ${col} = $1 AND s.status = 'accepted' AND s.slot_time >= $2 ORDER BY s.slot_time`,
    [userId, now])).rows;
};

exports.pendingFor = async (userId, role, now) => {
  const col = role === 'tutor' ? 's.tutor_id' : 's.learner_id';
  return (await query(
    `${JOINED} ${FROM} WHERE ${col} = $1 AND s.status = 'pending' AND s.expires_at > $2 ORDER BY s.created_at`,
    [userId, now])).rows;
};

exports.completedUnrated = async (learnerId) =>
  (await query(
    `${JOINED} ${FROM} WHERE s.learner_id = $1 AND s.status = 'completed' AND rt.id IS NULL ORDER BY s.slot_time DESC LIMIT 20`,
    [learnerId])).rows;

exports.sharedAccepted = async (a, b) =>
  (await query(
    `SELECT 1 FROM sessions WHERE status IN ('accepted','completed')
        AND ((learner_id = $1 AND tutor_id = $2) OR (learner_id = $2 AND tutor_id = $1)) LIMIT 1`, [a, b])).rowCount > 0;

// ---- job queries (take `now` so tests can move the clock) ----
exports.expirePending = async (now) =>
  (await query(
    `UPDATE sessions SET status = 'expired', responded_at = $1
      WHERE status = 'pending' AND expires_at <= $1 RETURNING id, learner_id, tutor_id`, [now])).rows;

exports.completeFinished = async (now) =>
  (await query(
    `UPDATE sessions SET status = 'completed' WHERE status = 'accepted' AND slot_time <= $1 RETURNING id`, [now])).rows;

exports.dueReminders = async (now, minutes) =>
  (await query(
    `UPDATE sessions SET reminder_sent = TRUE
      WHERE status = 'accepted' AND reminder_sent = FALSE AND slot_time > $1
        AND slot_time <= $1::timestamptz + make_interval(mins => $2)
      RETURNING id, learner_id, tutor_id, slot_time`, [now, minutes])).rows;

// ---- ratings ----
exports.insertRating = async (sessionId, score, comment, c) =>
  (await query(
    'INSERT INTO ratings (session_id, score, comment) VALUES ($1,$2,$3) RETURNING *', [sessionId, score, comment || null], c)).rows[0];

exports.findRating = async (sessionId, c) =>
  (await query('SELECT * FROM ratings WHERE session_id = $1', [sessionId], c)).rows[0];
