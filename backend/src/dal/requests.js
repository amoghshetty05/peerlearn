const { query } = require('./pool');

exports.create = async ({ learnerId, subject, topic, preferredTime, urgency }, c) =>
  (await query(
    `INSERT INTO help_requests (learner_id, subject, topic, preferred_time, urgency)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`, [learnerId, subject, topic, preferredTime, urgency], c)).rows[0];

exports.findById = async (id, c) =>
  (await query('SELECT * FROM help_requests WHERE id = $1', [id], c)).rows[0];

exports.listForLearner = async (learnerId) =>
  (await query('SELECT * FROM help_requests WHERE learner_id = $1 ORDER BY created_at DESC LIMIT 50', [learnerId])).rows;
