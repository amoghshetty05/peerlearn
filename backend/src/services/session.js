// CMP-06 Session Service: booking, accept/decline, 48-hour expiry, ratings, contact reveal (FR-08, FR-09, FR-14).
const sessions = require('../dal/sessions');
const requests = require('../dal/requests');
const tutors = require('../dal/tutors');
const users = require('../dal/users');
const { tx } = require('../dal/pool');
const notification = require('./notification');
const audit = require('./audit');
const clock = require('../utils/clock');
const config = require('../config');
const { localParts, toIst } = require('../utils/time');
const { E } = require('../errors');
const ser = require('../serializers');

const fmt = (d) => new Date(d).toLocaleString('en-IN', {
  timeZone: config.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

exports.request = async (learner, { requestId, tutorId, slotTime }) => {
  const now = clock.now();
  const result = await tx(async (c) => {
    const help = await requests.findById(requestId, c);
    if (!help || help.learner_id !== learner.id) throw E.notFound('Help request not found.');
    const tutor = await users.findById(tutorId, c);
    const teaches = tutor && tutor.role === 'tutor' && tutor.status === 'active'
      && (await tutors.listSubjects(tutorId, c)).some((s) => s.subject === help.subject);
    if (!teaches) throw E.notFound('This tutor is not available for that subject.');
    if (slotTime <= now) throw E.validation('Choose a time in the future.');
    const { isoWeekday, minutes } = localParts(slotTime);
    if (!(await tutors.slotCovers(tutorId, isoWeekday, minutes, c))) {
      throw E.validation("That time is outside this tutor's availability.");
    }
    if (await sessions.duplicateExists(requestId, tutorId, c)) throw E.conflict('You already asked this tutor for this request.');
    if (await sessions.tutorBusyAt(tutorId, slotTime, c)) throw E.conflict('This tutor already has a session at that time.');

    const expiresAt = new Date(now.getTime() + config.sessionExpiryHours * 3_600_000);
    const row = await sessions.insert({ requestId, learnerId: learner.id, tutorId, slotTime, expiresAt }, c);
    await notification.notify(tutorId, `${learner.name} asked for a ${help.subject} session on ${fmt(slotTime)}. Reply within 48 hours.`, c);
    await audit.record(learner.id, `BOOKING_REQUESTED session=${row.id} tutor=${tutorId}`, c);
    return row;
  });
  notification.flushSoon();
  return { id: result.id, status: result.status, expiresAt: toIst(new Date(result.expires_at)) };
};

exports.respond = async (tutor, sessionId, status) => {
  const now = clock.now();
  const row = await tx(async (c) => {
    const s = await sessions.lockById(sessionId, c);
    if (!s || s.tutor_id !== tutor.id) throw E.notFound('Session not found.');
    if (s.status !== 'pending') throw E.conflict(`This request is already ${s.status}.`);
    if (new Date(s.expires_at) <= now) throw E.conflict('This request has expired.');
    if (status === 'accepted' && await sessions.tutorBusyAt(tutor.id, s.slot_time, c)) {
      throw E.conflict('You already have an accepted session at that time.');
    }
    const updated = await sessions.setStatus(sessionId, status, now, c);
    const when = fmt(s.slot_time);
    if (status === 'accepted') {
      await notification.notify(s.learner_id, `${tutor.name} accepted your session on ${when}. Contact details are now visible.`, c);
      await notification.notify(s.tutor_id, `You accepted a session on ${when}. Contact details are now visible.`, c);
    } else {
      await notification.notify(s.learner_id, `${tutor.name} declined your session on ${when}. Try another tutor.`, c);
    }
    await audit.record(tutor.id, `BOOKING_${status.toUpperCase()} session=${sessionId}`, c);
    return updated;
  });
  notification.flushSoon();
  return ser.session(await sessions.findById(row.id), tutor.id);
};

exports.rate = async (learner, sessionId, { score, comment }) => {
  const s = await sessions.findById(sessionId);
  if (!s || s.learner_id !== learner.id) throw E.notFound('Session not found.');
  if (s.status !== 'completed') throw E.conflict('You can rate a session only after it is completed.');
  try {
    const r = await sessions.insertRating(sessionId, score, comment);
    return { id: r.id, sessionId, score: r.score, comment: r.comment };
  } catch (err) {
    if (err.code === '23505') throw E.conflict('You have already rated this session.');
    throw err;
  }
};

exports.list = async (user, status) => (await sessions.listForUser(user.id, user.role, status)).map((s) => ser.session(s, user.id));

// ---------- background jobs (each takes `now` so tests can move the clock) ----------
exports.expirePending = async (now = clock.now()) => {
  const expired = await tx(async (c) => {
    const rows = await sessions.expirePending(now);
    for (const s of rows) {
      await notification.notify(s.learner_id, 'Your session request expired because the tutor did not answer within 48 hours.', c);
    }
    return rows;
  });
  if (expired.length) notification.flushSoon();
  return expired.length;
};

exports.completeFinished = async (now = clock.now()) => (await sessions.completeFinished(now)).length;

exports.sendReminders = async (now = clock.now()) => {
  const due = await tx(async (c) => {
    const rows = await sessions.dueReminders(now, config.reminderMinutes);
    for (const s of rows) {
      const msg = `Reminder: your session starts at ${fmt(s.slot_time)}.`;
      await notification.notify(s.learner_id, msg, c);
      await notification.notify(s.tutor_id, msg, c);
    }
    return rows;
  });
  if (due.length) notification.flushSoon();
  return due.length;
};
