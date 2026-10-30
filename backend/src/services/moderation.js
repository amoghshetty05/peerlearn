// CMP-08 Moderation Service (FR-12).
const reports = require('../dal/reports');
const users = require('../dal/users');
const { tx } = require('../dal/pool');
const notification = require('./notification');
const audit = require('./audit');
const clock = require('../utils/clock');
const { E } = require('../errors');
const ser = require('../serializers');

exports.report = async (reporter, { reportedId, reason }) => {
  if (reportedId === reporter.id) throw E.validation('You cannot report yourself.');
  if (!(await users.findById(reportedId))) throw E.notFound('User not found.');
  const r = await reports.create({ reporterId: reporter.id, reportedId, reason });
  return { id: r.id, status: r.status };
};

exports.list = async (status) => (await reports.list(status)).map(ser.report);

const OUTCOME = { dismiss: 'dismissed', warn: 'warned', suspend: 'suspended' };

exports.resolve = async (admin, reportId, action) => {
  const result = await tx(async (c) => {
    const r = await reports.lockById(reportId, c);
    if (!r) throw E.notFound('Report not found.');
    if (r.status !== 'open') throw E.conflict(`This report is already ${r.status}.`);
    const target = await users.findById(r.reported_id, c);
    if (action !== 'dismiss' && target.role === 'admin') throw E.forbidden('Admins cannot be warned or suspended here.');

    if (action === 'warn') {
      await users.addWarning(target.id, c);
      await notification.notify(target.id, 'A moderator warned you after a report about your behaviour. Please follow the community rules.', c);
    }
    if (action === 'suspend') await users.suspend(target.id, c);

    const updated = await reports.resolve(reportId, OUTCOME[action], admin.id, clock.now(), c);
    await audit.record(admin.id, `ADMIN_${action.toUpperCase()} report=${reportId} user=${target.id}`, c);
    return updated;
  });
  notification.flushSoon();
  return { id: result.id, status: result.status };
};
