// CMP-04 Profile Service: tutor subjects and weekly availability (FR-03, FR-04) plus profile views (SR-03).
const tutors = require('../dal/tutors');
const users = require('../dal/users');
const sessions = require('../dal/sessions');
const { tx } = require('../dal/pool');
const { E } = require('../errors');
const { hhmmToMinutes } = require('../utils/time');
const ser = require('../serializers');

const MAX_SUBJECTS = 10;

const subjectView = (s) => ({ id: s.id, subject: s.subject, proficiency: s.proficiency });
const slotView = (s) => ({ id: s.id, weekday: s.weekday, startTime: s.start_time, endTime: s.end_time });

exports.addSubject = (tutorId, { subject, proficiency }) => tx(async (c) => {
  await tutors.lockTutor(tutorId, c);
  if (await tutors.countSubjects(tutorId, c) >= MAX_SUBJECTS) throw E.validation('You can teach at most 10 subjects.');
  const existing = (await tutors.listSubjects(tutorId, c)).find((s) => s.subject === subject);
  if (existing) throw E.conflict('You already teach this subject. Edit it instead.');
  return subjectView(await tutors.upsertSubject(tutorId, subject, proficiency, c));
});

exports.updateSubject = async (tutorId, id, patch) => {
  let row;
  try { row = await tutors.updateSubject(tutorId, id, patch); }
  catch (err) { if (err.code === '23505') throw E.conflict('You already teach this subject.'); throw err; }
  if (!row) throw E.notFound('Subject not found.');
  return subjectView(row);
};

exports.deleteSubject = async (tutorId, id) => {
  if (!(await tutors.deleteSubject(tutorId, id))) throw E.notFound('Subject not found.');
};

exports.addSlot = (tutorId, { weekday, startTime, endTime }) => tx(async (c) => {
  const minutes = hhmmToMinutes(endTime) - hhmmToMinutes(startTime);
  if (minutes < 30 || minutes > 120) throw E.validation('A slot must last between 30 and 120 minutes.');
  await tutors.lockTutor(tutorId, c);
  if (await tutors.countSlotOverlaps(tutorId, weekday, startTime, endTime, c)) throw E.slotOverlap();
  return slotView(await tutors.insertSlot(tutorId, weekday, startTime, endTime, c));
});

exports.deleteSlot = async (tutorId, id) => {
  if (!(await tutors.deleteSlot(tutorId, id))) throw E.notFound('Slot not found.');
};

exports.myTutorProfile = async (tutorId) => ({
  subjects: (await tutors.listSubjects(tutorId)).map(subjectView),
  availability: (await tutors.listSlots(tutorId)).map(slotView),
  rating: await tutors.ratingSummary(tutorId),
});

exports.updateMe = async (userId, patch) => ser.selfUser(await users.updateProfile(userId, patch));

// Profile of any user. Email and phone appear only for self, Admin, or the other party of an accepted session.
exports.viewUser = async (viewer, targetId) => {
  const target = await users.findById(targetId);
  if (!target || (target.status === 'suspended' && viewer.role !== 'admin')) throw E.notFound('User not found.');
  const profile = { id: target.id, name: target.name, role: target.role, createdAt: ser.iso(target.created_at) };
  if (target.role === 'tutor') {
    profile.subjects = (await tutors.listSubjects(target.id)).map(subjectView);
    profile.availability = (await tutors.listSlots(target.id)).map(slotView);
    profile.rating = await tutors.ratingSummary(target.id);
  }
  const allowed = viewer.id === target.id || viewer.role === 'admin' || await sessions.sharedAccepted(viewer.id, target.id);
  if (allowed) { profile.email = target.email; profile.phone = target.phone ?? null; }
  return profile;
};
