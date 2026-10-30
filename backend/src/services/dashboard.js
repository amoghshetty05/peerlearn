// FR-13: upcoming sessions, pending requests, and a Tutor's average rating.
const sessions = require('../dal/sessions');
const tutors = require('../dal/tutors');
const notifications = require('../dal/notifications');
const clock = require('../utils/clock');
const ser = require('../serializers');

exports.get = async (user) => {
  const now = clock.now();
  const [upcoming, pending, unread] = await Promise.all([
    sessions.upcomingAccepted(user.id, user.role, now),
    sessions.pendingFor(user.id, user.role, now),
    notifications.unreadCount(user.id),
  ]);
  const out = {
    upcomingSessions: upcoming.map((s) => ser.session(s, user.id)),
    pendingRequests: pending.map((s) => ser.session(s, user.id)),
    unreadNotifications: unread,
  };
  if (user.role === 'tutor') out.rating = await tutors.ratingSummary(user.id);
  if (user.role === 'learner') out.toRate = (await sessions.completedUnrated(user.id)).map((s) => ser.session(s, user.id));
  return out;
};
