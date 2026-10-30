const { closeAll, api, as, admin, resetDb, makeUser, nextMondayIst, PASSWORD } = require('../helpers');

beforeEach(resetDb);
afterAll(closeAll);

const INJECTIONS = ["' OR '1'='1", "'; DROP TABLE users; --", '" OR ""="', '1; SELECT pg_sleep(5)'];

describe('TC-15 injection and validation (SR-06)', () => {
  test('SQL injection in email and topic fields: no leak, tables unchanged', async () => {
    const victim = await makeUser('learner'); const tutor = await makeUser('tutor');
    const before = (await admin.query('SELECT (SELECT count(*) FROM users) u, (SELECT count(*) FROM help_requests) r')).rows[0];
    for (const bad of INJECTIONS) {
      const login = await api().post('/api/auth/login').send({ email: bad, password: bad });
      expect(login.status).toBe(401);
      expect(login.body.token).toBeUndefined();
      const reg = await api().post('/api/auth/register').send({ name: bad, email: bad, password: 'abcdef1234' });
      expect(reg.status).toBe(400); expect(reg.body.code).toBe('VALIDATION_ERROR');
      const rq = await api().post('/api/requests').set(as(victim)).send({
        subject: bad, topic: bad, preferredTime: nextMondayIst().toISOString(), urgency: 'Low' });
      expect([201, 400]).toContain(rq.status);
      if (rq.status === 201) { // stored as plain text, never executed
        const m = await api().get(`/api/requests/${rq.body.id}/matches`).set(as(victim));
        expect(m.body.matches).toHaveLength(0);
      }
      const prof = await api().get(`/api/users/${encodeURIComponent(bad)}`).set(as(victim));
      expect(prof.status).toBe(400);
    }
    const after = (await admin.query('SELECT (SELECT count(*) FROM users) u, (SELECT count(*) FROM help_requests) r')).rows[0];
    expect(after.u).toBe(before.u);
    expect((await admin.query('SELECT to_regclass($1) t', ['public.users'])).rows[0].t).toBe('users');
    expect(tutor.id).toBeDefined();
  });
  test('10,000-character topic is rejected with VALIDATION_ERROR', async () => {
    const l = await makeUser('learner');
    const res = await api().post('/api/requests').set(as(l)).send({
      subject: 'maths', topic: 'a'.repeat(10_000), preferredTime: nextMondayIst().toISOString(), urgency: 'Low' });
    expect(res.status).toBe(400); expect(res.body.code).toBe('VALIDATION_ERROR');
    expect((await admin.query('SELECT count(*) FROM help_requests')).rows[0].count).toBe('0');
  });
  test('wrong types, huge bodies, malformed JSON and bad ids all give the standard error shape', async () => {
    const l = await makeUser('learner');
    const wrongType = await api().post('/api/auth/login').send({ email: { $ne: null }, password: ['x'] });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body).toEqual({ status: 400, code: 'VALIDATION_ERROR', message: expect.any(String), requestId: expect.stringMatching(/^[a-f0-9]{6}$/) });
    const malformed = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(malformed.status).toBe(400);
    const huge = await api().post('/api/auth/register').send({ name: 'x'.repeat(200_000), email: 'a@pes.edu', password: 'abcdef1234' });
    expect(huge.status).toBe(400);
    expect((await api().get('/api/requests/abc/matches').set(as(l))).status).toBe(400);
    expect((await api().get('/api/requests/99999999999/matches').set(as(l))).status).toBe(400);
    expect((await api().get('/api/requests/999/matches').set(as(l))).status).toBe(404);
    const nf = await api().get('/api/nothing-here').set(as(l));
    expect(nf.status).toBe(404); expect(nf.body.code).toBe('NOT_FOUND');
  });
  test('internal errors return INTERNAL_ERROR with a request id and no details', async () => {
    const l = await makeUser('learner');
    const { pool } = require('../../src/dal/pool');
    const spy = jest.spyOn(pool, 'query').mockRejectedValueOnce(Object.assign(new Error('relation "secret_table" does not exist'), { code: '42P01' }));
    const res = await api().get('/api/dashboard').set(as(l));
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/secret_table|stack|at /);
    expect(res.body.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });
  test('registration checks name length and phone format; profile update works', async () => {
    const l = await makeUser('learner');
    const reg = (o) => api().post('/api/auth/register').send({ name: 'Ana', email: `${Math.random().toString(36).slice(2, 8)}@pes.edu`, password: PASSWORD, ...o });
    expect((await reg({ name: '' })).status).toBe(400);
    expect((await reg({ name: 'x'.repeat(101) })).status).toBe(400);
    expect((await reg({ phone: 'call me' })).status).toBe(400);
    expect((await reg({ phone: '+91 98450 12345' })).status).toBe(201);
    const up = await api().put('/api/users/me').set(as(l)).send({ phone: '+91 99999 00000', name: 'New Name' });
    expect(up.body).toMatchObject({ name: 'New Name', phone: '+91 99999 00000' });
    expect((await api().put('/api/users/me').set(as(l)).send({})).status).toBe(400);
  });
});

describe('security headers', () => {
  test('helmet headers present and X-Powered-By hidden', async () => {
    const res = await api().get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
