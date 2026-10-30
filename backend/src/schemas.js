// Server-side validation of type, length and format for every input (SR-06).
const { z } = require('zod');

const id = z.coerce.number().int().positive().max(2147483647);
const text = (max, min = 1) => z.string().trim().min(min).max(max);
const email = z.string().trim().toLowerCase().max(254)
  .regex(/^[^@\s]+@pes\.edu$/, 'Use your @pes.edu email address.');
const subject = z.string().trim().min(1).max(60)
  .transform((s) => s.toLowerCase().replace(/\s+/g, ' '))
  .refine((s) => !/[\u0000-\u001f<>]/.test(s), 'Subject contains invalid characters.');
const proficiency = z.enum(['Beginner', 'Intermediate', 'Advanced']);
const phone = z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number.');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour).');
const isoTime = z.string().datetime({ offset: true }).transform((s) => new Date(s));

const DAYS = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const weekday = z.preprocess(
  (v) => (typeof v === 'string' && DAYS[v.slice(0, 3).toLowerCase()] ? DAYS[v.slice(0, 3).toLowerCase()] : v),
  z.number().int().min(1).max(7));

const passwordBytes = (s) => Buffer.byteLength(s, 'utf8') <= 72; // bcrypt ignores bytes beyond 72

module.exports = {
  idParam: z.object({ id }),
  register: z.object({
    name: text(100),
    email,
    password: z.string().min(8, 'Password must be at least 8 characters.').max(72).refine(passwordBytes, 'Password is too long.'),
    role: z.enum(['learner', 'tutor']).default('learner'),
    phone: phone.optional(),
  }),
  login: z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().min(1).max(128) }),
  updateMe: z.object({ name: text(100).optional(), phone: phone.nullable().optional() })
    .refine((o) => o.name !== undefined || o.phone !== undefined, 'Nothing to update.'),
  subjectCreate: z.object({ subject, proficiency }),
  subjectUpdate: z.object({ subject: subject.optional(), proficiency: proficiency.optional() })
    .refine((o) => o.subject !== undefined || o.proficiency !== undefined, 'Nothing to update.'),
  slotCreate: z.object({ weekday, startTime: hhmm, endTime: hhmm }),
  helpRequest: z.object({ subject, topic: text(200), preferredTime: isoTime, urgency: z.enum(['Low', 'Normal', 'High']) }),
  sessionCreate: z.object({ requestId: id, tutorId: id, slotTime: isoTime }),
  sessionPatch: z.object({ status: z.enum(['accepted', 'declined']) }),
  sessionList: z.object({ status: z.enum(['pending', 'accepted', 'declined', 'expired', 'completed']).optional() }),
  rating: z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(300).optional() }),
  groupCreate: z.object({ name: text(100).optional(), subject, maxSize: z.number().int().min(3).max(10) }),
  groupList: z.object({ subject: subject.optional() }),
  report: z.object({ reportedId: id, reason: text(500, 3) }),
  adminPatch: z.object({ action: z.enum(['dismiss', 'warn', 'suspend']) }),
  reportList: z.object({ status: z.enum(['open', 'dismissed', 'warned', 'suspended']).optional() }),
  notificationList: z.object({ unread: z.enum(['true', 'false']).optional() }),
};
