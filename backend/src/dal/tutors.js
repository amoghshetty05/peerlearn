const { query } = require('./pool');

exports.listSubjects = async (tutorId, c) =>
  (await query('SELECT id, subject, proficiency FROM tutor_subjects WHERE tutor_id = $1 ORDER BY subject', [tutorId], c)).rows;

exports.upsertSubject = async (tutorId, subject, proficiency, c) =>
  (await query(
    `INSERT INTO tutor_subjects (tutor_id, subject, proficiency) VALUES ($1,$2,$3)
     ON CONFLICT (tutor_id, subject) DO UPDATE SET proficiency = EXCLUDED.proficiency
     RETURNING id, subject, proficiency`, [tutorId, subject, proficiency], c)).rows[0];

exports.deleteSubject = async (tutorId, id, c) =>
  (await query('DELETE FROM tutor_subjects WHERE id = $1 AND tutor_id = $2', [id, tutorId], c)).rowCount;

exports.listSlots = async (tutorId, c) =>
  (await query(
    `SELECT id, weekday, to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time
       FROM availability_slots WHERE tutor_id = $1 ORDER BY weekday, start_time`, [tutorId], c)).rows;

exports.countSlotOverlaps = async (tutorId, weekday, start, end, c) =>
  Number((await query(
    `SELECT count(*) FROM availability_slots
      WHERE tutor_id = $1 AND weekday = $2 AND start_time < $4::time AND end_time > $3::time`,
    [tutorId, weekday, start, end], c)).rows[0].count);

exports.insertSlot = async (tutorId, weekday, start, end, c) =>
  (await query(
    `INSERT INTO availability_slots (tutor_id, weekday, start_time, end_time) VALUES ($1,$2,$3,$4)
     RETURNING id, weekday, to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time`,
    [tutorId, weekday, start, end], c)).rows[0];

exports.deleteSlot = async (tutorId, id, c) =>
  (await query('DELETE FROM availability_slots WHERE id = $1 AND tutor_id = $2', [id, tutorId], c)).rowCount;

exports.lockTutor = (tutorId, c) => query('SELECT pg_advisory_xact_lock($1)', [tutorId], c);

exports.ratingSummary = async (tutorId, c) =>
  (await query(
    `SELECT COALESCE(round(avg(r.score)::numeric, 2), 0)::float AS average, count(r.id)::int AS count
       FROM ratings r JOIN sessions s ON s.id = r.session_id WHERE s.tutor_id = $1`, [tutorId], c)).rows[0];

// Matching candidates: active tutors that teach the subject, with slot coverage and rating facts.
exports.matchCandidates = async (subject, isoWeekday, minutes) =>
  (await query(
    `SELECT u.id, u.name, ts.proficiency,
            COALESCE(r.avg_score, 0)::float AS avg_rating, COALESCE(r.cnt, 0)::int AS rating_count,
            EXISTS (SELECT 1 FROM availability_slots a WHERE a.tutor_id = u.id AND a.weekday = $2
                     AND a.start_time <= make_interval(mins => $3)::time AND a.end_time > make_interval(mins => $3)::time) AS covers,
            EXISTS (SELECT 1 FROM availability_slots a WHERE a.tutor_id = u.id AND a.weekday = $2) AS same_day
       FROM users u
       JOIN tutor_subjects ts ON ts.tutor_id = u.id AND ts.subject = $1
       LEFT JOIN (SELECT s.tutor_id, avg(rt.score) AS avg_score, count(*) AS cnt
                    FROM ratings rt JOIN sessions s ON s.id = rt.session_id GROUP BY s.tutor_id) r ON r.tutor_id = u.id
      WHERE u.role = 'tutor' AND u.status = 'active'`, [subject, isoWeekday, minutes])).rows;

exports.slotsFor = async (tutorIds) =>
  (await query(
    `SELECT id, tutor_id, weekday, to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time
       FROM availability_slots WHERE tutor_id = ANY($1::int[]) ORDER BY weekday, start_time`, [tutorIds])).rows;

// Does the instant fall inside one of this tutor's weekly slots?
exports.slotCovers = async (tutorId, isoWeekday, minutes, c) =>
  (await query(
    `SELECT 1 FROM availability_slots WHERE tutor_id = $1 AND weekday = $2
        AND start_time <= make_interval(mins => $3)::time AND end_time > make_interval(mins => $3)::time LIMIT 1`,
    [tutorId, isoWeekday, minutes], c)).rowCount > 0;

exports.updateSubject = async (tutorId, id, { subject, proficiency }, c) =>
  (await query(
    `UPDATE tutor_subjects SET subject = COALESCE($3, subject), proficiency = COALESCE($4, proficiency)
      WHERE id = $1 AND tutor_id = $2 RETURNING id, subject, proficiency`,
    [id, tutorId, subject ?? null, proficiency ?? null], c)).rows[0];

exports.countSubjects = async (tutorId, c) =>
  Number((await query('SELECT count(*) FROM tutor_subjects WHERE tutor_id = $1', [tutorId], c)).rows[0].count);
