// External Email Service wrapper (SMTP). Only the Notification Service uses it.
const nodemailer = require('nodemailer');
const config = require('../config');
const notifications = require('../dal/notifications');
const logger = require('../utils/logger');
const clock = require('../utils/clock');

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true }); // no SMTP configured: hand-off is simulated

let sender = (msg) => transport.sendMail(msg);
exports.setSender = (fn) => { sender = fn || ((m) => transport.sendMail(m)); }; // tests inject failures

// Sends every due email; failures are retried later with exponential back-off, never raised to callers.
exports.flush = async () => {
  const now = clock.now();
  const due = await notifications.dueEmails(now);
  for (const m of due) {
    try {
      await sender({ from: config.smtp.from, to: m.to_email, subject: m.subject, text: m.body });
      await notifications.markEmailSent(m.id, clock.now());
    } catch (err) {
      const attempts = m.attempts + 1;
      const delayMin = Math.min(2 ** attempts, 240);
      await notifications.markEmailFailed(m.id, attempts, new Date(now.getTime() + delayMin * 60_000));
      logger.warn('Email failed, will retry', { id: m.id, attempts, error: err.message });
    }
  }
  return due.length;
};
