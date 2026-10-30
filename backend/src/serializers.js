// Response serialisers: the single place that decides which fields leave the API (SR-02, SR-03).
const { toIst } = require('./utils/time');

const iso = (d) => (d ? toIst(new Date(d)) : null);

const selfUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone ?? null,
  status: u.status, createdAt: iso(u.created_at),
});

const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role });

const session = (s, viewerId) => {
  const revealed = ['accepted', 'completed'].includes(s.status);
  const isLearner = viewerId === s.learner_id;
  const other = isLearner
    ? { id: s.tutor_id, name: s.tutor_name, email: s.tutor_email, phone: s.tutor_phone }
    : { id: s.learner_id, name: s.learner_name, email: s.learner_email, phone: s.learner_phone };
  return {
    id: s.id, requestId: s.request_id, subject: s.subject, topic: s.topic, status: s.status,
    slotTime: iso(s.slot_time), createdAt: iso(s.created_at), expiresAt: iso(s.expires_at),
    learner: { id: s.learner_id, name: s.learner_name },
    tutor: { id: s.tutor_id, name: s.tutor_name },
    rated: Boolean(s.rated),
    // The other party's contact details appear only after the Tutor accepts (FR-14).
    counterpart: revealed ? { id: other.id, name: other.name, email: other.email, phone: other.phone ?? null }
                          : { id: other.id, name: other.name },
  };
};

const request = (r) => ({
  id: r.id, subject: r.subject, topic: r.topic, preferredTime: iso(r.preferred_time),
  urgency: r.urgency, createdAt: iso(r.created_at),
});

const group = (g) => ({
  id: g.id, name: g.name, subject: g.subject, maxSize: g.max_size, ownerId: g.owner_id,
  ownerName: g.owner_name, memberCount: g.member_count, joined: Boolean(g.joined), createdAt: iso(g.created_at),
});

const report = (r) => ({
  id: r.id, reporterId: r.reporter_id, reportedId: r.reported_id, reason: r.reason, status: r.status,
  createdAt: iso(r.created_at), reporterName: r.reporter_name, reportedName: r.reported_name,
  reportedStatus: r.reported_status, reportedWarnings: r.reported_warnings,
});

const notification = (n) => ({ id: n.id, message: n.message, read: n.read, createdAt: iso(n.created_at) });

module.exports = { selfUser, publicUser, session, request, group, report, notification, iso };
