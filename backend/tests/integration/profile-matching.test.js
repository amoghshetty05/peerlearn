const { closeAll, api, as, admin, resetDb, makeUser, addSubject, addSlot, nextMondayIst, createRequest } = require('../helpers');

beforeEach(resetDb);
afterAll(closeAll);

describe('TC-05 subjects and availability (FR-03, FR-04)', () => {
  test('overlap gives 409 SLOT_OVERLAP; touching slots are fine; 11th subject rejected', async () => {
    const t = await makeUser('tutor');
    const slot = (weekday, startTime, endTime) => api().post('/api/tutors/me/availability').set(as(t)).send({ weekday, startTime, endTime });
    expect((await slot(1, '16:00', '17:00')).status).toBe(201);
    const overlap = await slot(1, '16:30', '17:30');
    expect(overlap.status).toBe(409);
    expect(overlap.body.code).toBe('SLOT_OVERLAP');
    expect((await slot(1, '17:00', '18:00')).status).toBe(201);   // back-to-back is not an overlap
    expect((await slot(2, '16:30', '17:30')).status).toBe(201);   // other weekday
    for (let i = 1; i <= 10; i++) {
      const r = await api().post('/api/tutors/me/subjects').set(as(t)).send({ subject: `subject ${i}`, proficiency: 'Beginner' });
      expect(r.status).toBe(201);
    }
    const eleventh = await api().post('/api/tutors/me/subjects').set(as(t)).send({ subject: 'subject 11', proficiency: 'Beginner' });
    expect(eleventh.status).toBe(400);
    expect(eleventh.body.code).toBe('VALIDATION_ERROR');
  });
  test('slot length boundaries: 30 and 120 minutes pass, 29 and 121 fail', async () => {
    const t = await makeUser('tutor');
    const slot = (d, s, e) => api().post('/api/tutors/me/availability').set(as(t)).send({ weekday: d, startTime: s, endTime: e });
    expect((await slot(1, '10:00', '10:30')).status).toBe(201);
    expect((await slot(2, '10:00', '12:00')).status).toBe(201);
    expect((await slot(3, '10:00', '10:29')).status).toBe(400);
    expect((await slot(4, '10:00', '12:01')).status).toBe(400);
    expect((await slot(5, '12:00', '11:00')).status).toBe(400);
    expect((await slot(8, '10:00', '11:00')).status).toBe(400);
  });
  test('edit and delete a subject; subjects are normalised; invalid proficiency rejected', async () => {
    const t = await makeUser('tutor');
    const add = await api().post('/api/tutors/me/subjects').set(as(t)).send({ subject: '  Linear   Algebra ', proficiency: 'Beginner' });
    expect(add.body.subject).toBe('linear algebra');
    const put = await api().put(`/api/tutors/me/subjects/${add.body.id}`).set(as(t)).send({ proficiency: 'Advanced' });
    expect(put.body.proficiency).toBe('Advanced');
    expect((await api().post('/api/tutors/me/subjects').set(as(t)).send({ subject: 'x', proficiency: 'Expert' })).status).toBe(400);
    expect((await api().delete(`/api/tutors/me/subjects/${add.body.id}`).set(as(t))).status).toBe(204);
    expect((await api().delete(`/api/tutors/me/subjects/${add.body.id}`).set(as(t))).status).toBe(404);
    const other = await makeUser('tutor');
    const mine = await api().post('/api/tutors/me/subjects').set(as(t)).send({ subject: 'physics', proficiency: 'Beginner' });
    expect((await api().delete(`/api/tutors/me/subjects/${mine.body.id}`).set(as(other))).status).toBe(404);
  });
});

describe('TC-06 ranked matches (FR-05, FR-06, FR-07, FR-15)', () => {
  test('exactly 5 tutors, descending, none without maths, capped at 100, bonus only for the rated tutor', async () => {
    const learner = await makeUser('learner');
    const when = nextMondayIst(16, 30);
    const tutors = [];
    for (let i = 0; i < 7; i++) tutors.push(await makeUser('tutor'));
    const levels = ['Advanced', 'Advanced', 'Intermediate', 'Intermediate', 'Beginner', 'Beginner'];
    for (let i = 0; i < 6; i++) { await addSubject(tutors[i], 'maths', levels[i]); await addSlot(tutors[i], 1); }
    await addSubject(tutors[6], 'physics', 'Advanced'); await addSlot(tutors[6], 1);   // no maths: excluded
    // tutors[0] (already 100 points) gets 3 ratings of 5 -> bonus must not push it above 100
    // tutors[4] (Beginner) gets 3 ratings of 4 -> bonus 8
    for (const [tutor, score] of [[tutors[0], 5], [tutors[4], 4]]) {
      for (let k = 0; k < 3; k++) {
        const l = await makeUser('learner');
        const rq = await admin.query(`INSERT INTO help_requests (learner_id,subject,topic,preferred_time,urgency) VALUES ($1,'maths','t',now(),'Low') RETURNING id`, [l.id]);
        const s = await admin.query(`INSERT INTO sessions (request_id,learner_id,tutor_id,slot_time,status,expires_at) VALUES ($1,$2,$3,now(),'completed',now()) RETURNING id`, [rq.rows[0].id, l.id, tutor.id]);
        await admin.query('INSERT INTO ratings (session_id,score) VALUES ($1,$2)', [s.rows[0].id, score]);
      }
    }
    const created = await createRequest(learner, 'maths', when);
    expect(created.id).toBeDefined();
    const res = await api().get(`/api/requests/${created.id}/matches`).set(as(learner));
    expect(res.status).toBe(200);
    const m = res.body.matches;
    expect(m).toHaveLength(5);
    expect(m.map((x) => x.tutorId)).not.toContain(tutors[6].id);
    const scores = m.map((x) => x.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(Math.max(...scores)).toBe(100);
    expect(m[0].tutorId).toBe(tutors[0].id);
    const rated4 = m.find((x) => x.tutorId === tutors[4].id);
    expect(rated4.breakdown.ratingBonus).toBe(8);
    expect(m.filter((x) => x.breakdown.ratingBonus > 0).map((x) => x.tutorId).sort()).toEqual([tutors[0].id, tutors[4].id].sort());
    expect(m[0].availableSlots[0]).toMatchObject({ weekday: 1, startTime: '16:00', endTime: '17:00' });
    expect(m[0].availableSlots[0].upcoming).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/@pes\.edu|phone/);
  });
  test('availability: slot covering the time scores higher than same weekday, higher than other day', async () => {
    const learner = await makeUser('learner');
    const [a, b, c] = [await makeUser('tutor'), await makeUser('tutor'), await makeUser('tutor')];
    for (const t of [a, b, c]) await addSubject(t, 'maths', 'Advanced');
    await addSlot(a, 1, '16:00', '17:00'); await addSlot(b, 1, '09:00', '10:00'); await addSlot(c, 3, '16:00', '17:00');
    const rq = await createRequest(learner, 'maths', nextMondayIst(16, 30));
    const { body } = await api().get(`/api/requests/${rq.id}/matches`).set(as(learner));
    expect(body.matches.map((x) => [x.tutorId, x.breakdown.availability])).toEqual([[a.id, 30], [b.id, 15], [c.id, 0]]);
  });
  test('suspended tutors are excluded; other learners cannot read the matches', async () => {
    const learner = await makeUser('learner'); const other = await makeUser('learner'); const t = await makeUser('tutor');
    await addSubject(t, 'maths'); await admin.query("UPDATE users SET status='suspended' WHERE id=$1", [t.id]);
    const rq = await createRequest(learner);
    expect((await api().get(`/api/requests/${rq.id}/matches`).set(as(learner))).body.matches).toHaveLength(0);
    expect((await api().get(`/api/requests/${rq.id}/matches`).set(as(other))).status).toBe(404);
  });
  test('help request validation (FR-05)', async () => {
    const l = await makeUser('learner');
    const post = (o) => api().post('/api/requests').set(as(l)).send({ subject: 'maths', topic: 'limits', preferredTime: nextMondayIst().toISOString(), urgency: 'High', ...o });
    expect((await post({})).status).toBe(201);
    expect((await post({ urgency: 'Urgent' })).status).toBe(400);
    expect((await post({ preferredTime: 'tomorrow' })).status).toBe(400);
    expect((await post({ preferredTime: new Date(Date.now() - 3600_000).toISOString() })).status).toBe(400);
    expect((await post({ topic: '' })).status).toBe(400);
  });
});

describe('TC-13 matching speed (NFR-03)', () => {
  test('20 match requests with 1,000 users and 200 tutors each return in under 2 seconds', async () => {
    const { seedPerf } = require('../../scripts/seed-perf');
    const adminUrl = (process.env.TEST_ADMIN_URL || 'postgres://postgres:postgres@localhost:5432/postgres').replace(/\/[^/]*$/, '/peerlearn_test');
    const ids = await seedPerf(adminUrl, { users: 1000, tutors: 200 });
    const learner = { id: ids.learners[0], role: 'learner' };
    const times = [];
    for (let i = 0; i < 20; i++) {
      const subject = ['maths', 'physics', 'chemistry', 'algorithms'][i % 4];
      const rq = await createRequest(learner, subject, nextMondayIst(16, 30, 1 + (i % 3)));
      const t0 = Date.now();
      const res = await api().get(`/api/requests/${rq.id}/matches`).set(as(learner));
      times.push(Date.now() - t0);
      expect(res.status).toBe(200);
      expect(res.body.matches.length).toBe(5);
    }
    expect(Math.max(...times)).toBeLessThan(2000);
  }, 120000);
});
