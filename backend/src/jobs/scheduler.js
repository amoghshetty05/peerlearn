// Background jobs: 48-hour expiry (FR-08), 1-hour reminders (FR-11), completion, email retries.
const session = require('../services/session');
const email = require('../services/email');
const users = require('../dal/users');
const logger = require('../utils/logger');

const safe = (name, fn) => async () => {
  try { await fn(); } catch (err) { logger.error(`Job ${name} failed`, { error: err.message }); }
};

exports.start = () => {
  const timers = [
    setInterval(safe('expire', () => session.expirePending()), 60_000),
    setInterval(safe('complete', () => session.completeFinished()), 60_000),
    setInterval(safe('remind', () => session.sendReminders()), 60_000),
    setInterval(safe('email', () => email.flush()), 30_000),
    setInterval(safe('purge-tokens', () => users.purgeRevoked(new Date())), 3_600_000),
  ];
  timers.forEach((t) => t.unref());
  return () => timers.forEach(clearInterval);
};
