// CMP-02 API Layer. Every protected route runs: rate limiter (global) -> authenticate -> authorize -> validate -> controller.
const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const S = require('../schemas');
const ser = require('../serializers');
const { E } = require('../errors');

const auth = require('../services/auth');
const profile = require('../services/profile');
const matching = require('../services/matching');
const session = require('../services/session');
const group = require('../services/group');
const moderation = require('../services/moderation');
const notification = require('../services/notification');
const dashboard = require('../services/dashboard');

const router = express.Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next); // async error bridge
const guard = (...roles) => (roles.length ? [authenticate, authorize(...roles)] : [authenticate]);
const LT = ['learner', 'tutor'];

// ---- API-01 / API-02: public ----
router.post('/auth/register', validate({ body: S.register }), h(async (req, res) => res.status(201).json(await auth.register(req.body))));
router.post('/auth/login', validate({ body: S.login }), h(async (req, res) => res.json(await auth.login(req.body))));
router.post('/auth/logout', ...guard(), h(async (req, res) => { await auth.logout(req.user.id, req.token); res.status(204).end(); }));

// ---- own account (supporting endpoints) ----
router.get('/users/me', ...guard(), h(async (req, res) => res.json(ser.selfUser(req.user))));
router.put('/users/me', ...guard(), validate({ body: S.updateMe }), h(async (req, res) => res.json(await profile.updateMe(req.user.id, req.body))));
router.get('/users/:id', ...guard(), validate({ params: S.idParam }), h(async (req, res) => res.json(await profile.viewUser(req.user, req.params.id))));

// ---- API-03 / API-04: tutor profile ----
router.get('/tutors/me', ...guard('tutor'), h(async (req, res) => res.json(await profile.myTutorProfile(req.user.id))));
router.post('/tutors/me/subjects', ...guard('tutor'), validate({ body: S.subjectCreate }),
  h(async (req, res) => res.status(201).json(await profile.addSubject(req.user.id, req.body))));
router.put('/tutors/me/subjects/:id', ...guard('tutor'), validate({ params: S.idParam, body: S.subjectUpdate }),
  h(async (req, res) => res.json(await profile.updateSubject(req.user.id, req.params.id, req.body))));
router.delete('/tutors/me/subjects/:id', ...guard('tutor'), validate({ params: S.idParam }),
  h(async (req, res) => { await profile.deleteSubject(req.user.id, req.params.id); res.status(204).end(); }));
router.post('/tutors/me/availability', ...guard('tutor'), validate({ body: S.slotCreate }),
  h(async (req, res) => res.status(201).json(await profile.addSlot(req.user.id, req.body))));
router.delete('/tutors/me/availability/:id', ...guard('tutor'), validate({ params: S.idParam }),
  h(async (req, res) => { await profile.deleteSlot(req.user.id, req.params.id); res.status(204).end(); }));

// ---- API-05 / API-06: help requests and matches ----
router.post('/requests', ...guard('learner'), validate({ body: S.helpRequest }),
  h(async (req, res) => res.status(201).json(await matching.createRequest(req.user.id, req.body))));
router.get('/requests', ...guard('learner'), h(async (req, res) => res.json(await matching.listRequests(req.user.id))));
router.get('/requests/:id/matches', ...guard('learner'), validate({ params: S.idParam }),
  h(async (req, res) => res.json(await matching.getMatches(req.user.id, req.params.id))));

// ---- API-07 / API-08 / API-09: sessions ----
router.post('/sessions', ...guard('learner'), validate({ body: S.sessionCreate }),
  h(async (req, res) => res.status(201).json(await session.request(req.user, req.body))));
router.get('/sessions', ...guard('learner', 'tutor'), validate({ query: S.sessionList }),
  h(async (req, res) => res.json(await session.list(req.user, req.query.status))));
router.patch('/sessions/:id', ...guard('tutor'), validate({ params: S.idParam, body: S.sessionPatch }),
  h(async (req, res) => res.json(await session.respond(req.user, req.params.id, req.body.status))));
router.post('/sessions/:id/rating', ...guard('learner'), validate({ params: S.idParam, body: S.rating }),
  h(async (req, res) => res.status(201).json(await session.rate(req.user, req.params.id, req.body))));

// ---- API-10: study groups ----
router.post('/groups', ...guard(...LT), validate({ body: S.groupCreate }), h(async (req, res) => res.status(201).json(await group.create(req.user, req.body))));
router.get('/groups', ...guard(...LT), validate({ query: S.groupList }), h(async (req, res) => res.json(await group.list(req.user, req.query.subject))));
router.get('/groups/:id', ...guard(...LT), validate({ params: S.idParam }), h(async (req, res) => res.json(await group.get(req.user, req.params.id))));
router.post('/groups/:id/join', ...guard(...LT), validate({ params: S.idParam }), h(async (req, res) => res.json(await group.join(req.user, req.params.id))));
router.delete('/groups/:id/join', ...guard(...LT), validate({ params: S.idParam }), h(async (req, res) => res.json(await group.leave(req.user, req.params.id))));

// ---- API-11: notifications ----
router.get('/notifications', ...guard(...LT), validate({ query: S.notificationList }),
  h(async (req, res) => res.json((await notification.list(req.user.id, req.query.unread === 'true')).map(ser.notification))));
router.patch('/notifications/:id', ...guard(...LT), validate({ params: S.idParam }),
  h(async (req, res) => { if (!(await notification.markRead(req.user.id, req.params.id))) throw E.notFound(); res.status(204).end(); }));
router.post('/notifications/read-all', ...guard(...LT), h(async (req, res) => { await notification.markAllRead(req.user.id); res.status(204).end(); }));

// ---- API-12 / API-13: moderation ----
router.post('/reports', ...guard(...LT), validate({ body: S.report }), h(async (req, res) => res.status(201).json(await moderation.report(req.user, req.body))));
router.get('/admin/reports', ...guard('admin'), validate({ query: S.reportList }), h(async (req, res) => res.json(await moderation.list(req.query.status))));
router.patch('/admin/reports/:id', ...guard('admin'), validate({ params: S.idParam, body: S.adminPatch }),
  h(async (req, res) => res.json(await moderation.resolve(req.user, req.params.id, req.body.action))));

// ---- API-14: dashboard ----
router.get('/dashboard', ...guard(...LT), h(async (req, res) => res.json(await dashboard.get(req.user))));

module.exports = router;
