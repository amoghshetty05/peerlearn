const { closeAll, api, as, tokenFor, admin, resetDb, makeUser, PASSWORD } = require('../helpers');
const jwt = require('jsonwebtoken');
const config = require('../../src/config');

beforeEach(resetDb);
afterAll(closeAll);

describe('TC-01 / TC-02 registration (FR-01)', () => {
  test('TC-01 valid registration returns 201, no password, and the user can log in', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Ana', email: 'ana@pes.edu', password: 'abcdef1234' });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    expect(res.body.role).toBe('learner');
    const login = await api().post('/api/auth/login').send({ email: 'ana@pes.edu', password: 'abcdef1234' });
    expect(login.status).toBe(200);
  });
  test('tutor role can be chosen; admin cannot self-register', async () => {
    const t = await api().post('/api/auth/register').send({ name: 'T', email: 't@pes.edu', password: 'abcdef1234', role: 'tutor' });
    expect(t.body.role).toBe('tutor');
    const a = await api().post('/api/auth/register').send({ name: 'A', email: 'a@pes.edu', password: 'abcdef1234', role: 'admin' });
    expect(a.status).toBe(400);
  });
  test('TC-02 non-university email is rejected and no account is created', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Ana', email: 'ana@gmail.com', password: 'abcdef1234' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect((await admin.query('SELECT count(*) FROM users')).rows[0].count).toBe('0');
  });
  test('short password (boundary 7 vs 8) and duplicate email', async () => {
    const body = { name: 'Ana', email: 'ana@pes.edu' };
    expect((await api().post('/api/auth/register').send({ ...body, password: '1234567' })).status).toBe(400);
    expect((await api().post('/api/auth/register').send({ ...body, password: '12345678' })).status).toBe(201);
    const dup = await api().post('/api/auth/register').send({ ...body, password: '12345678' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('CONFLICT');
  });
  test('uppercase email is treated as the same address', async () => {
    await api().post('/api/auth/register').send({ name: 'Ana', email: 'Ana@PES.edu', password: '12345678' });
    const login = await api().post('/api/auth/login').send({ email: 'ana@pes.edu', password: '12345678' });
    expect(login.status).toBe(200);
  });
});

describe('TC-03 login (FR-02, SR-04)', () => {
  test('correct password gives 200 and a token; wrong gives 401 and no token', async () => {
    const u = await makeUser('learner');
    const ok = await api().post('/api/auth/login').send({ email: u.email, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));
    expect(ok.body.user).toEqual({ id: u.id, name: u.name, role: 'learner' });
    const bad = await api().post('/api/auth/login').send({ email: u.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.token).toBeUndefined();
    expect(bad.body.code).toBe('UNAUTHENTICATED');
    const unknown = await api().post('/api/auth/login').send({ email: 'nobody@pes.edu', password: 'whatever1' });
    expect(unknown.status).toBe(401);
  });
  test('logout ends the session: the token stops working', async () => {
    const u = await makeUser('learner');
    const { body } = await api().post('/api/auth/login').send({ email: u.email, password: PASSWORD });
    const h = { Authorization: `Bearer ${body.token}` };
    expect((await api().get('/api/dashboard').set(h)).status).toBe(200);
    expect((await api().post('/api/auth/logout').set(h)).status).toBe(204);
    expect((await api().get('/api/dashboard').set(h)).status).toBe(401);
  });
});

describe('TC-04 role restriction (SR-05)', () => {
  test('Learner and Tutor tokens get 403 on admin endpoints; report is unchanged', async () => {
    const learner = await makeUser('learner'); const tutor = await makeUser('tutor');
    const r = await admin.query('INSERT INTO reports (reporter_id, reported_id, reason) VALUES ($1,$2,$3) RETURNING id', [learner.id, tutor.id, 'rude']);
    for (const u of [learner, tutor]) {
      const res = await api().patch(`/api/admin/reports/${r.rows[0].id}`).set(as(u)).send({ action: 'suspend' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect((await api().get('/api/admin/reports').set(as(u))).status).toBe(403);
    }
    expect((await admin.query('SELECT status FROM reports')).rows[0].status).toBe('open');
  });
  test('learner-only and tutor-only endpoints reject the other role', async () => {
    const learner = await makeUser('learner'); const tutor = await makeUser('tutor');
    expect((await api().post('/api/tutors/me/subjects').set(as(learner)).send({ subject: 'maths', proficiency: 'Advanced' })).status).toBe(403);
    expect((await api().post('/api/requests').set(as(tutor)).send({})).status).toBe(403);
  });
});

describe('TC-19 token and HTTPS (SR-01, SR-04)', () => {
  test('no token and wrong token get 401 UNAUTHENTICATED', async () => {
    const none = await api().get('/api/dashboard');
    expect(none.status).toBe(401); expect(none.body.code).toBe('UNAUTHENTICATED');
    const wrong = await api().get('/api/dashboard').set({ Authorization: 'Bearer not.a.token' });
    expect(wrong.status).toBe(401);
    const forged = jwt.sign({ sub: '1' }, 'another-secret', { expiresIn: '2h' });
    expect((await api().get('/api/dashboard').set({ Authorization: `Bearer ${forged}` })).status).toBe(401);
  });
  test('a 3-hour-old token gets 401 TOKEN_EXPIRED', async () => {
    const u = await makeUser('learner');
    const iat = Math.floor(Date.now() / 1000) - 3 * 3600;
    const old = jwt.sign({ sub: String(u.id), role: 'learner', jti: 'x', iat }, config.jwtSecret, { expiresIn: '2h' });
    const res = await api().get('/api/dashboard').set({ Authorization: `Bearer ${old}` });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });
  test('tokens live for 2 hours', async () => {
    const u = await makeUser('learner');
    const { body } = await api().post('/api/auth/login').send({ email: u.email, password: PASSWORD });
    const { iat, exp } = jwt.decode(body.token);
    expect(exp - iat).toBe(7200);
  });
  test('plain HTTP is redirected to HTTPS when enforcement is on', async () => {
    const { app } = require('../helpers');
    app.set('enforceHttps', true);
    try {
      const res = await api().get('/api/dashboard').set('X-Forwarded-Proto', 'http').set('Host', 'peerlearn.pes.edu');
      expect(res.status).toBe(308);
      expect(res.headers.location).toBe('https://peerlearn.pes.edu/api/dashboard');
      const ok = await api().get('/api/dashboard').set('X-Forwarded-Proto', 'https');
      expect(ok.status).toBe(401);
    } finally { app.set('enforceHttps', false); }
  });
});

describe('TC-14 lockout and rate limit (SR-08, NFR-04)', () => {
  test('5 wrong passwords lock the account; the correct password then gets 423', async () => {
    const u = await makeUser('learner');
    for (let i = 0; i < 5; i++) {
      const r = await api().post('/api/auth/login').send({ email: u.email, password: 'wrong-password' });
      expect(r.status).toBe(401);
    }
    const locked = await api().post('/api/auth/login').send({ email: u.email, password: PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
    const row = (await admin.query('SELECT locked_until FROM users WHERE id=$1', [u.id])).rows[0];
    const mins = (new Date(row.locked_until) - Date.now()) / 60000;
    expect(mins).toBeGreaterThan(14); expect(mins).toBeLessThanOrEqual(15);
  });
  test('lock expires after 15 minutes and a successful login resets the counter', async () => {
    const clock = require('../../src/utils/clock');
    const u = await makeUser('learner');
    for (let i = 0; i < 5; i++) await api().post('/api/auth/login').send({ email: u.email, password: 'wrong-password' });
    clock.advance(16 * 60_000);
    const ok = await api().post('/api/auth/login').send({ email: u.email, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect((await admin.query('SELECT failed_logins FROM users WHERE id=$1', [u.id])).rows[0].failed_logins).toBe(0);
  });
  test('the 101st request in a minute gets 429; other users are unaffected', async () => {
    const u = await makeUser('learner'); const other = await makeUser('learner');
    let last;
    for (let i = 0; i < 100; i++) { last = await api().get('/api/users/me').set(as(u)); expect(last.status).toBe(200); }
    last = await api().get('/api/users/me').set(as(u));
    expect(last.status).toBe(429);
    expect(last.body.code).toBe('RATE_LIMITED');
    expect((await api().get('/api/users/me').set(as(other))).status).toBe(200);
  }, 120000);
});

describe('TC-12 password storage and no secrets in responses (NFR-01, SR-02)', () => {
  test('hash is bcrypt $2b$ cost >= 10 and no endpoint returns hash or token fields', async () => {
    await api().post('/api/auth/register').send({ name: 'Ana', email: 'ana@pes.edu', password: 'abcdef1234' });
    const row = (await admin.query('SELECT password_hash FROM users')).rows[0];
    expect(row.password_hash).toMatch(/^\$2b\$(1[0-9]|[2-3][0-9])\$/);
    const login = await api().post('/api/auth/login').send({ email: 'ana@pes.edu', password: 'abcdef1234' });
    const me = await api().get('/api/users/me').set({ Authorization: `Bearer ${login.body.token}` });
    const id = me.body.id;
    const others = await makeUser('tutor');
    const bodies = [me.body,
      (await api().get(`/api/users/${id}`).set({ Authorization: `Bearer ${login.body.token}` })).body,
      (await api().get(`/api/users/${others.id}`).set({ Authorization: `Bearer ${login.body.token}` })).body,
      (await api().get('/api/dashboard').set({ Authorization: `Bearer ${login.body.token}` })).body,
      (await api().put('/api/users/me').set({ Authorization: `Bearer ${login.body.token}` }).send({ phone: '+91 98450 00000' })).body];
    for (const b of bodies) expect(JSON.stringify(b)).not.toMatch(/password|hash|\$2b\$|token/i);
  });
});

describe('anonymous rate limit', () => {
  test('anonymous traffic is limited per IP at a higher ceiling than the per-user limit', async () => {
    let status;
    for (let i = 0; i < config.rateLimit.anonMax; i++) status = (await api().get('/api/auth/nothing')).status;
    expect(status).toBe(404);
    expect((await api().get('/api/auth/nothing')).status).toBe(429);
  }, 120000);
});
