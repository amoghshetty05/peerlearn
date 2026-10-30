// Small, friendly demo data for the 30 Oct demo. Password for every demo account: Password123
const bcrypt = require('bcrypt');
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await c.connect();
  const hash = await bcrypt.hash('Password123', 12);
  const mk = async (name, email, role, phone) =>
    (await c.query(`INSERT INTO users (name,email,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [name, email, hash, role, phone])).rows[0].id;
  const asha = await mk('Asha Rao', 'asha@pes.edu', 'learner', '+91 98450 11111');
  await mk('Vikram Shetty', 'vikram@pes.edu', 'learner', '+91 98450 22222');
  const tutors = [
    ['Meera Iyer', 'meera@pes.edu', '+91 98450 33333', [['maths', 'Advanced'], ['statistics', 'Intermediate']], [1, 3]],
    ['Rohan Gowda', 'rohan@pes.edu', '+91 98450 44444', [['maths', 'Intermediate'], ['algorithms', 'Advanced']], [2, 4]],
    ['Nisha Kulkarni', 'nisha@pes.edu', '+91 98450 55555', [['maths', 'Beginner'], ['physics', 'Advanced']], [1, 5]],
    ['Arjun Menon', 'arjun@pes.edu', '+91 98450 66666', [['databases', 'Advanced'], ['maths', 'Advanced']], [3, 6]],
  ];
  for (const [name, email, phone, subs, days] of tutors) {
    const id = await mk(name, email, 'tutor', phone);
    await c.query('DELETE FROM tutor_subjects WHERE tutor_id = $1', [id]);
    await c.query('DELETE FROM availability_slots WHERE tutor_id = $1', [id]);
    for (const [s, p] of subs) await c.query('INSERT INTO tutor_subjects (tutor_id,subject,proficiency) VALUES ($1,$2,$3)', [id, s, p]);
    for (const d of days) await c.query(`INSERT INTO availability_slots (tutor_id,weekday,start_time,end_time) VALUES ($1,$2,'16:00','17:00')`, [id, d]);
  }
  console.log('Demo users ready: asha@pes.edu, vikram@pes.edu (learners); meera/rohan/nisha/arjun@pes.edu (tutors). Password: Password123');
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
