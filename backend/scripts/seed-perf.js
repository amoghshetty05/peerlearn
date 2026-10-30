// TC-13 / TC-18 seed: 1,000 users including 200 Tutors, each with subjects, slots and some ratings.
// All seeded accounts share the password "Password123" (one bcrypt hash, so seeding takes seconds).
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const SUBJECTS = ['maths', 'physics', 'chemistry', 'algorithms', 'databases', 'economics', 'statistics', 'networks'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

async function seedPerf(adminUrl, { users = 1000, tutors = 200 } = {}) {
  const c = new Client({ connectionString: adminUrl });
  await c.connect();
  try {
    const hash = await bcrypt.hash('Password123', 10);
    await c.query('BEGIN');
    const ids = { tutors: [], learners: [] };
    for (let i = 0; i < users; i++) {
      const role = i < tutors ? 'tutor' : 'learner';
      const r = await c.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [`Perf ${role} ${i}`, `perf${i}@pes.edu`, hash, role]);
      ids[role === 'tutor' ? 'tutors' : 'learners'].push(r.rows[0].id);
    }
    for (const [i, id] of ids.tutors.entries()) {
      for (let k = 0; k < 3; k++) {
        await c.query(`INSERT INTO tutor_subjects (tutor_id, subject, proficiency) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [id, SUBJECTS[(i + k) % SUBJECTS.length], LEVELS[(i + k) % 3]]);
      }
      for (let d = 1; d <= 3; d++) {
        await c.query(`INSERT INTO availability_slots (tutor_id, weekday, start_time, end_time) VALUES ($1,$2,'16:00','17:00')`,
          [id, ((i + d) % 7) + 1]);
      }
    }
    // a few completed + rated sessions so the rating bonus path is exercised
    for (let i = 0; i < 60; i++) {
      const tutor = ids.tutors[i % 20], learner = ids.learners[i % ids.learners.length];
      const req = await c.query(
        `INSERT INTO help_requests (learner_id, subject, topic, preferred_time, urgency)
         VALUES ($1,$2,'seed topic', now() - interval '2 days','Normal') RETURNING id`, [learner, SUBJECTS[i % SUBJECTS.length]]);
      const s = await c.query(
        `INSERT INTO sessions (request_id, learner_id, tutor_id, slot_time, status, expires_at)
         VALUES ($1,$2,$3, now() - interval '1 day','completed', now()) RETURNING id`, [req.rows[0].id, learner, tutor]);
      await c.query('INSERT INTO ratings (session_id, score) VALUES ($1,$2)', [s.rows[0].id, 3 + (i % 3)]);
    }
    await c.query('COMMIT');
    return ids;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { await c.end(); }
}
module.exports = { seedPerf };

if (require.main === module) {
  seedPerf(process.env.DATABASE_ADMIN_URL).then((ids) => console.log(`Seeded ${ids.tutors.length} tutors, ${ids.learners.length} learners`))
    .catch((e) => { console.error(e); process.exit(1); });
}
