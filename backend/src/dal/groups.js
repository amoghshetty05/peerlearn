const { query } = require('./pool');

const WITH_COUNT = `
  SELECT g.*, u.name AS owner_name, (SELECT count(*) FROM group_members m WHERE m.group_id = g.id)::int AS member_count,
         EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = $1) AS joined
    FROM study_groups g JOIN users u ON u.id = g.owner_id`;

exports.create = async ({ name, subject, maxSize, ownerId }, c) =>
  (await query(
    'INSERT INTO study_groups (name, subject, max_size, owner_id) VALUES ($1,$2,$3,$4) RETURNING *',
    [name || null, subject, maxSize, ownerId], c)).rows[0];

exports.list = async (userId, subject) =>
  (await query(`${WITH_COUNT} ${subject ? 'WHERE g.subject = $2' : ''} ORDER BY g.created_at DESC LIMIT 100`,
    subject ? [userId, subject] : [userId])).rows;

exports.findWithCount = async (id, userId, c) =>
  (await query(`${WITH_COUNT} WHERE g.id = $2`, [userId, id], c)).rows[0];

exports.lockGroup = async (id, c) =>
  (await query('SELECT * FROM study_groups WHERE id = $1 FOR UPDATE', [id], c)).rows[0];

exports.memberCount = async (id, c) =>
  Number((await query('SELECT count(*) FROM group_members WHERE group_id = $1', [id], c)).rows[0].count);

exports.isMember = async (id, userId, c) =>
  (await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [id, userId], c)).rowCount > 0;

exports.addMember = (id, userId, c) =>
  query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)', [id, userId], c);

exports.removeMember = async (id, userId, c) =>
  (await query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [id, userId], c)).rowCount;

exports.members = async (id) =>
  (await query(
    `SELECT u.id, u.name, u.role FROM group_members m JOIN users u ON u.id = m.user_id
      WHERE m.group_id = $1 ORDER BY m.joined_at`, [id])).rows;
