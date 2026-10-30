const { closeAll, api, as, admin, resetDb, makeUser, nextMondayIst } = require('../helpers');

beforeEach(resetDb);
afterAll(closeAll);

// TC-18 in miniature (the full 1-minute, 100-user run is `npm run load`).
test('TC-18 (short form): 100 concurrent users on GET /dashboard and POST /requests, 95% under 1 second', async () => {
  const users = [];
  for (let i = 0; i < 100; i++) users.push(await makeUser('learner'));
  const times = [];
  const run = async (u) => {
    for (let round = 0; round < 3; round++) {
      let t0 = Date.now();
      const d = await api().get('/api/dashboard').set(as(u));
      times.push(Date.now() - t0); expect(d.status).toBe(200);
      t0 = Date.now();
      const r = await api().post('/api/requests').set(as(u)).send({
        subject: 'maths', topic: 'limits', preferredTime: nextMondayIst().toISOString(), urgency: 'Normal' });
      times.push(Date.now() - t0); expect(r.status).toBe(201);
    }
  };
  await Promise.all(users.map(run));
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  expect(p95).toBeLessThan(1000);
}, 120000);
