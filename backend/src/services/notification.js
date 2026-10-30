// CMP-09 Notification Service: in-app notification now, email through the outbox (retried if SMTP fails).
const notifications = require('../dal/notifications');
const users = require('../dal/users');
const email = require('./email');
const logger = require('../utils/logger');

// Call inside the caller's transaction so the notification commits or rolls back with the booking.
exports.notify = async (userId, message, client) => {
  await notifications.insert(userId, message, client);
  const user = await users.findById(userId, client);
  if (user) await notifications.enqueueEmail(user.email, 'PeerLearn update', message, client);
};

// Call after COMMIT. A failed email never cancels a booking.
exports.flushSoon = () => { email.flush().catch((e) => logger.warn('Email flush failed', { error: e.message })); };

exports.list = async (userId, unreadOnly) => notifications.list(userId, unreadOnly);
exports.unreadCount = notifications.unreadCount;
exports.markRead = notifications.markRead;
exports.markAllRead = notifications.markAllRead;
