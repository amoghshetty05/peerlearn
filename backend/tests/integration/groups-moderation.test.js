const { closeAll, api, as, admin, resetDb, makeUser, PASSWORD } = require('../helpers');
const { Pool } = require('pg');
const config = require('../../src/config');

beforeEach(resetDb);
afterAll(closeAll);

describe('TC-10 group capacity (FR-10)', () => {
  test('first 3 join, 4th gets GROUP_FULL, after a leave the 4th can join', async () => {
    const owner = await makeUser('tutor');
    const g = await api().post('/api/groups').set(as(owner)).send({ name: 'Calculus crew', subject: 'Maths', maxSize: 3 });
    expect(g.status).toBe(201);
    expect(g.body.subject).toBe('maths');
    const ls = []; for (let i = 0; i < 4; i++) ls.push(await makeUser('learner'));
    for (let i = 0; i < 3; i++) expect((await api().post(`/api/groups/${g.body.id}/join`).set(as(ls[i]))).status).toBe(200);
    const full = await api().post(`/api/groups/${g.body.id}/join`).set(as(ls[3]));
    expect(full.status).toBe(409); expect(full.body.code).toBe('GROUP_FULL');
    expect((await api().post(`/api/groups/${g.body.id}/join`).set(as(ls[0]))).status).toBe(409); // already in
    expect((await api().delete(`/api/groups/${g.body.id}/join`).set(as(ls[0]))).status).toBe(200);
    expect((await api().delete(`/api/groups/${g.body.id}/join`).set(as(ls[0]))).status).toBe(404);
    expect((await api().post(`/api/groups/${g.body.id}/join`).set(as(ls[3]))).status).toBe(200);
    const detail = await api().get(`/api/groups/${g.body.id}`).set(as(ls[3]));
    expect(detail.body.memberCount).toBe(3); expect(detail.body.joined).toBe(true); expect(detail.body.members).toHaveLength(3);
    expect(JSON.stringify(detail.body)).not.toMatch(/@pes\.edu|phone/);
  });
  test('size boundaries 3..10 and the last seat is not double-booked under concurrency', async () => {
    const o = await makeUser('learner');
    const mk = (maxSize) => api().post('/api/groups').set(as(o)).send({ subject: 'maths', maxSize });
    expect((await mk(2)).status).toBe(400); expect((await mk(11)).status).toBe(400);
    expect((await mk(3)).status).toBe(201); expect((await mk(10)).status).toBe(201);
    const g = (await mk(3)).body; const ls = []; for (let i = 0; i < 6; i++) ls.push(await makeUser('learner'));
    const results = await Promise.all(ls.map((l) => api().post(`/api/groups/${g.id}/join`).set(as(l))));
    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.body.code === 'GROUP_FULL')).toHaveLength(3);
  });
  test('admins cannot use group endpoints; list filters by subject', async () => {
    const a = await makeUser('admin'); const u = await makeUser('learner');
    expect((await api().post('/api/groups').set(as(a)).send({ subject: 'maths', maxSize: 4 })).status).toBe(403);
    await api().post('/api/groups').set(as(u)).send({ subject: 'maths', maxSize: 4 });
    await api().post('/api/groups').set(as(u)).send({ subject: 'physics', maxSize: 4 });
    expect((await api().get('/api/groups?subject=Physics').set(as(u))).body).toHaveLength(1);
  });
});

describe('TC-11 report and suspend (FR-12)', () => {
  test('report stored, admin suspends, tutor cannot log in, admin action logged', async () => {
    const learner = await makeUser('learner'); const tutor = await makeUser('tutor'); const adm = await makeUser('admin');
    const rep = await api().post('/api/reports').set(as(learner)).send({ reportedId: tutor.id, reason: 'Did not show up' });
    expect(rep.status).toBe(201);
    expect((await admin.query('SELECT reason, status FROM reports')).rows[0]).toEqual({ reason: 'Did not show up', status: 'open' });
    const list = await api().get('/api/admin/reports?status=open').set(as(adm));
    expect(list.body[0]).toMatchObject({ reporterName: learner.name, reportedName: tutor.name });
    const res = await api().patch(`/api/admin/reports/${rep.body.id}`).set(as(adm)).send({ action: 'suspend' });
    expect(res.status).toBe(200); expect(res.body.status).toBe('suspended');
    const login = await api().post('/api/auth/login').send({ email: tutor.email, password: PASSWORD });
    expect(login.status).toBe(403); expect(login.body.code).toBe('ACCOUNT_SUSPENDED');
    // an already-issued token stops working immediately too
    expect((await api().get('/api/dashboard').set(as(tutor))).status).toBe(403);
    const log = await admin.query("SELECT user_id, action FROM audit_log WHERE action LIKE 'ADMIN_%'");
    expect(log.rows).toEqual([{ user_id: adm.id, action: `ADMIN_SUSPEND report=${rep.body.id} user=${tutor.id}` }]);
    expect((await api().patch(`/api/admin/reports/${rep.body.id}`).set(as(adm)).send({ action: 'dismiss' })).status).toBe(409);
  });
  test('warn notifies the user and counts a warning; dismiss changes nothing else', async () => {
    const l = await makeUser('learner'); const t = await makeUser('tutor'); const adm = await makeUser('admin');
    const r1 = await api().post('/api/reports').set(as(l)).send({ reportedId: t.id, reason: 'Rude messages' });
    await api().patch(`/api/admin/reports/${r1.body.id}`).set(as(adm)).send({ action: 'warn' });
    expect((await admin.query('SELECT warnings, status FROM users WHERE id=$1', [t.id])).rows[0]).toEqual({ warnings: 1, status: 'active' });
    expect((await api().get('/api/notifications').set(as(t))).body[0].message).toMatch(/warned/);
    const r2 = await api().post('/api/reports').set(as(l)).send({ reportedId: t.id, reason: 'False alarm' });
    await api().patch(`/api/admin/reports/${r2.body.id}`).set(as(adm)).send({ action: 'dismiss' });
    expect((await admin.query('SELECT warnings FROM users WHERE id=$1', [t.id])).rows[0].warnings).toBe(1);
  });
  test('cannot report yourself or a missing user; reason length enforced', async () => {
    const l = await makeUser('learner');
    expect((await api().post('/api/reports').set(as(l)).send({ reportedId: l.id, reason: 'me' + 'x'.repeat(5) })).status).toBe(400);
    expect((await api().post('/api/reports').set(as(l)).send({ reportedId: 99999, reason: 'valid reason' })).status).toBe(404);
    expect((await api().post('/api/reports').set(as(l)).send({ reportedId: 1, reason: 'x'.repeat(501) })).status).toBe(400);
  });
});

describe('TC-16 audit log (NFR-06, SR-07)', () => {
  test('login, booking and admin action are recorded; edit and delete are refused', async () => {
    const { addSubject, addSlot, nextMondayIst, createRequest } = require('../helpers');
    const learner = await makeUser('learner'); const tutor = await makeUser('tutor'); const adm = await makeUser('admin');
    await addSubject(tutor, 'maths'); await addSlot(tutor, 1);
    await api().post('/api/auth/login').send({ email: learner.email, password: PASSWORD });
    const when = nextMondayIst(16, 30);
    const rq = await createRequest(learner, 'maths', when);
    await api().post('/api/sessions').set(as(learner)).send({ requestId: rq.id, tutorId: tutor.id, slotTime: when.toISOString() });
    const rep = await api().post('/api/reports').set(as(learner)).send({ reportedId: tutor.id, reason: 'testing audit' });
    await api().patch(`/api/admin/reports/${rep.body.id}`).set(as(adm)).send({ action: 'dismiss' });

    const rows = (await admin.query('SELECT user_id, action, timestamp FROM audit_log ORDER BY id')).rows;
    expect(rows.map((r) => r.action.split(' ')[0])).toEqual(['LOGIN', 'BOOKING_REQUESTED', 'ADMIN_DISMISS']);
    for (const r of rows) { expect(r.user_id).toBeGreaterThan(0); expect(r.timestamp).toBeInstanceOf(Date); }

    // no API route exists to change the log
    for (const method of ['put', 'patch', 'delete', 'post']) {
      expect((await api()[method]('/api/audit').set(as(adm)).send({})).status).toBe(404);
    }
    // the application database user cannot edit or delete rows
    const appPool = new Pool({ connectionString: config.databaseUrl });
    await expect(appPool.query("UPDATE audit_log SET action = 'x'")).rejects.toThrow(/permission denied/);
    await expect(appPool.query('DELETE FROM audit_log')).rejects.toThrow(/permission denied/);
    await expect(appPool.query('TRUNCATE audit_log')).rejects.toThrow(/permission denied/);
    await appPool.end();
    // even the table owner is stopped by the trigger
    await expect(admin.query("UPDATE audit_log SET action = 'x'")).rejects.toThrow(/append-only/);
    await expect(admin.query('DELETE FROM audit_log')).rejects.toThrow(/append-only/);
    expect((await admin.query('SELECT count(*) FROM audit_log')).rows[0].count).toBe('3');
  });
});
