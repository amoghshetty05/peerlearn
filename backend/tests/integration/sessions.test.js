const { closeAll, api, as, admin, resetDb, makeUser, addSubject, addSlot, nextMondayIst, createRequest } = require('../helpers');
const clock = require('../../src/utils/clock');
const sessionService = require('../../src/services/session');
const email = require('../../src/services/email');

beforeEach(resetDb);
afterAll(closeAll);

async function setup() {
  const learner = await makeUser('learner'); const tutor = await makeUser('tutor');
  await addSubject(tutor, 'maths', 'Advanced'); await addSlot(tutor, 1, '16:00', '17:00');
  const when = nextMondayIst(16, 30);
  const rq = await createRequest(learner, 'maths', when);
  return { learner, tutor, rq, when };
}
const book = (learner, rq, tutor, when) =>
  api().post('/api/sessions').set(as(learner)).send({ requestId: rq.id, tutorId: tutor.id, slotTime: when.toISOString() });

describe('TC-07 booking and contact privacy (FR-08, FR-11, FR-14, SR-03)', () => {
  test('contact hidden until acceptance, then visible; both users notified', async () => {
    const { learner, tutor, rq, when } = await setup();
    const res = await book(learner, rq, tutor, when);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    const exp = new Date(res.body.expiresAt).getTime() - Date.now();
    expect(exp).toBeGreaterThan(47.9 * 3600_000); expect(exp).toBeLessThanOrEqual(48 * 3600_000);
    expect(res.body.expiresAt).toMatch(/\+05:30$/);

    const before = await api().get(`/api/users/${tutor.id}`).set(as(learner));
    expect(before.status).toBe(200);
    expect(before.body.email).toBeUndefined(); expect(before.body.phone).toBeUndefined();
    const tutorView = await api().get(`/api/users/${learner.id}`).set(as(tutor));
    expect(tutorView.body.email).toBeUndefined();
    const dashBefore = await api().get('/api/dashboard').set(as(tutor));
    expect(dashBefore.body.pendingRequests[0].counterpart.email).toBeUndefined();

    // tutor was told about the request
    const tn = await api().get('/api/notifications').set(as(tutor));
    expect(tn.body.some((n) => /asked for a maths session/.test(n.message))).toBe(true);

    const acc = await api().patch(`/api/sessions/${res.body.id}`).set(as(tutor)).send({ status: 'accepted' });
    expect(acc.status).toBe(200);
    expect(acc.body.status).toBe('accepted');
    expect(acc.body.counterpart.email).toBe(learner.email);

    const after = await api().get(`/api/users/${tutor.id}`).set(as(learner));
    expect(after.body.email).toBe(tutor.email); expect(after.body.phone).toBe(tutor.phone);
    const dash = await api().get('/api/dashboard').set(as(learner));
    expect(dash.body.upcomingSessions).toHaveLength(1);
    expect(dash.body.upcomingSessions[0].counterpart.phone).toBe(tutor.phone);

    for (const u of [learner, tutor]) {
      const n = await api().get('/api/notifications').set(as(u));
      expect(n.body.some((x) => /accepted/.test(x.message))).toBe(true);
    }
    // a stranger still sees no contact details, and an admin always does
    const stranger = await makeUser('learner'); const adminUser = await makeUser('admin');
    expect((await api().get(`/api/users/${tutor.id}`).set(as(stranger))).body.email).toBeUndefined();
    expect((await api().get(`/api/users/${tutor.id}`).set(as(adminUser))).body.email).toBe(tutor.email);
    expect((await api().get(`/api/users/${tutor.id}`).set(as(tutor))).body.email).toBe(tutor.email);
  });
  test('decline notifies the learner and reveals nothing', async () => {
    const { learner, tutor, rq, when } = await setup();
    const s = await book(learner, rq, tutor, when);
    const d = await api().patch(`/api/sessions/${s.body.id}`).set(as(tutor)).send({ status: 'declined' });
    expect(d.body.status).toBe('declined');
    expect(d.body.counterpart.email).toBeUndefined();
    expect((await api().get('/api/notifications').set(as(learner))).body[0].message).toMatch(/declined/);
    expect((await api().patch(`/api/sessions/${s.body.id}`).set(as(tutor)).send({ status: 'accepted' })).status).toBe(409);
  });
  test('booking rules: outside availability, past, duplicate, wrong subject, not your request', async () => {
    const { learner, tutor, rq, when } = await setup();
    const tuesday = new Date(when.getTime() + 86_400_000);
    expect((await book(learner, rq, tutor, tuesday)).status).toBe(400);
    expect((await book(learner, rq, tutor, new Date(Date.now() - 86_400_000))).status).toBe(400);
    expect((await book(learner, rq, tutor, when)).status).toBe(201);
    expect((await book(learner, rq, tutor, when)).status).toBe(409);
    const other = await makeUser('tutor'); await addSubject(other, 'physics'); await addSlot(other, 1);
    expect((await book(learner, rq, other, when)).status).toBe(404);
    const stranger = await makeUser('learner');
    expect((await book(stranger, rq, tutor, when)).status).toBe(404);
  });
  test('only the addressed tutor can answer', async () => {
    const { learner, tutor, rq, when } = await setup();
    const s = await book(learner, rq, tutor, when);
    const other = await makeUser('tutor');
    expect((await api().patch(`/api/sessions/${s.body.id}`).set(as(other)).send({ status: 'accepted' })).status).toBe(404);
    expect((await api().patch(`/api/sessions/${s.body.id}`).set(as(tutor)).send({ status: 'maybe' })).status).toBe(400);
  });
  test('a tutor cannot accept two sessions at the same time', async () => {
    const { learner, tutor, rq, when } = await setup();
    const l2 = await makeUser('learner'); const rq2 = await createRequest(l2, 'maths', when);
    const a = await book(learner, rq, tutor, when); const b = await book(l2, rq2, tutor, when);
    expect((await api().patch(`/api/sessions/${a.body.id}`).set(as(tutor)).send({ status: 'accepted' })).status).toBe(200);
    expect((await api().patch(`/api/sessions/${b.body.id}`).set(as(tutor)).send({ status: 'accepted' })).status).toBe(409);
  });
  test('a failing email service never cancels the booking and is retried later', async () => {
    const { learner, tutor, rq, when } = await setup();
    email.setSender(async () => { throw new Error('SMTP down'); });
    try {
      expect((await book(learner, rq, tutor, when)).status).toBe(201);
      await email.flush();
      const failed = (await admin.query('SELECT attempts, sent_at FROM email_outbox')).rows[0];
      expect(failed.sent_at).toBeNull(); expect(failed.attempts).toBeGreaterThan(0);
    } finally { email.setSender(null); }
    clock.advance(10 * 60_000);
    await email.flush();
    expect((await admin.query('SELECT sent_at FROM email_outbox')).rows[0].sent_at).not.toBeNull();
  });
});

describe('TC-08 request expiry (FR-08, FR-11)', () => {
  test('after 49 hours the expiry job marks it expired and notifies the learner', async () => {
    const { learner, tutor, rq, when } = await setup();
    const s = await book(learner, rq, tutor, when);
    expect(await sessionService.expirePending(clock.now())).toBe(0);
    clock.advance(49 * 3600_000);
    // an answer after the deadline is refused even before the job runs
    expect((await api().patch(`/api/sessions/${s.body.id}`).set(as(tutor)).send({ status: 'accepted' })).status).toBe(409);
    expect(await sessionService.expirePending(clock.now())).toBe(1);
    expect((await admin.query('SELECT status FROM sessions')).rows[0].status).toBe('expired');
    const n = await api().get('/api/notifications').set(as(learner));
    expect(n.body.some((x) => /expired/.test(x.message))).toBe(true);
  });
});

describe('reminders and completion (FR-11)', () => {
  test('one hour before start both users get a reminder, once', async () => {
    const { learner, tutor, rq, when } = await setup();
    const s = await book(learner, rq, tutor, when);
    await api().patch(`/api/sessions/${s.body.id}`).set(as(tutor)).send({ status: 'accepted' });
    expect(await sessionService.sendReminders(new Date(when.getTime() - 2 * 3600_000))).toBe(0);
    expect(await sessionService.sendReminders(new Date(when.getTime() - 50 * 60_000))).toBe(1);
    expect(await sessionService.sendReminders(new Date(when.getTime() - 40 * 60_000))).toBe(0);
    for (const u of [learner, tutor]) {
      expect((await api().get('/api/notifications').set(as(u))).body.some((x) => /Reminder/.test(x.message))).toBe(true);
    }
  });
  test('accepted sessions become completed after their start time', async () => {
    const { learner, tutor, rq, when } = await setup();
    const s = await book(learner, rq, tutor, when);
    await api().patch(`/api/sessions/${s.body.id}`).set(as(tutor)).send({ status: 'accepted' });
    expect(await sessionService.completeFinished(new Date(when.getTime() - 1000))).toBe(0);
    expect(await sessionService.completeFinished(new Date(when.getTime() + 1000))).toBe(1);
    const dash = await api().get('/api/dashboard').set(as(learner));
    expect(dash.body.toRate).toHaveLength(1);
  });
  test('notifications can be marked read', async () => {
    const { learner, tutor, rq, when } = await setup();
    await book(learner, rq, tutor, when);
    const list = (await api().get('/api/notifications').set(as(tutor))).body;
    expect((await api().patch(`/api/notifications/${list[0].id}`).set(as(tutor))).status).toBe(204);
    expect((await api().get('/api/notifications?unread=true').set(as(tutor))).body).toHaveLength(0);
    expect((await api().patch(`/api/notifications/${list[0].id}`).set(as(learner))).status).toBe(404);
  });
});

describe('TC-09 ratings (FR-09) and tutor dashboard rating (FR-13)', () => {
  test('pending rejected, 5 accepted, repeat 409, 6 gives 400', async () => {
    const { learner, tutor, rq, when } = await setup();
    const s = await book(learner, rq, tutor, when);
    const rate = (id, body) => api().post(`/api/sessions/${id}/rating`).set(as(learner)).send(body);
    const pending = await rate(s.body.id, { score: 5 });
    expect(pending.status).toBe(409);
    await api().patch(`/api/sessions/${s.body.id}`).set(as(tutor)).send({ status: 'accepted' });
    await sessionService.completeFinished(new Date(when.getTime() + 1000));
    expect((await rate(s.body.id, { score: 6 })).status).toBe(400);
    expect((await rate(s.body.id, { score: 0 })).status).toBe(400);
    expect((await rate(s.body.id, { score: 4.5 })).status).toBe(400);
    expect((await rate(s.body.id, { score: 5, comment: 'x'.repeat(301) })).status).toBe(400);
    const ok = await rate(s.body.id, { score: 5, comment: 'x'.repeat(300) });
    expect(ok.status).toBe(201);
    const again = await rate(s.body.id, { score: 3 });
    expect(again.status).toBe(409); expect(again.body.code).toBe('CONFLICT');
    const stranger = await makeUser('learner');
    expect((await api().post(`/api/sessions/${s.body.id}/rating`).set(as(stranger)).send({ score: 5 })).status).toBe(404);
    const dash = await api().get('/api/dashboard').set(as(tutor));
    expect(dash.body.rating).toEqual({ average: 5, count: 1 });
  });
});
