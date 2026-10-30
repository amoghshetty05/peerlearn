const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const request = require('supertest');
const { Pool } = require('pg');

const adminBase = process.env.TEST_ADMIN_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const admin = new Pool({ connectionString: adminBase.replace(/\/[^/]*$/, '/peerlearn_test'), max: 4 });

const { createApp } = require('../src/app');
const rateLimiter = require('../src/middleware/rateLimiter');
const clock = require('../src/utils/clock');
const config = require('../src/config');
const app = createApp();

const PASSWORD = 'Password123';
const HASH = bcrypt.hashSync(PASSWORD, 10);
let seq = 0;

async function resetDb() {
  await admin.query(`TRUNCATE users, tutor_subjects, availability_slots, help_requests, sessions, ratings,
    study_groups, group_members, reports, notifications, audit_log, email_outbox, revoked_tokens RESTART IDENTITY CASCADE`);
  rateLimiter.reset();
  clock.reset();
}

async function makeUser(role = 'learner', overrides = {}) {
  seq += 1;
  const row = {
    name: `${role} ${seq}`, email: `${role}${seq}@pes.edu`, phone: `+91 90000 ${String(seq).padStart(5, '0')}`, ...overrides,
  };
  const r = await admin.query(
    'INSERT INTO users (name,email,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [row.name, row.email, HASH, role, row.phone]);
  return r.rows[0];
}

const tokenFor = (user, opts = {}) =>
  jwt.sign({ sub: String(user.id), role: user.role, jti: crypto.randomUUID(), ...(opts.payload || {}) },
    config.jwtSecret, { algorithm: 'HS256', expiresIn: '2h' });

const api = () => request(app);
const as = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

async function addSubject(tutor, subject, proficiency = 'Intermediate') {
  await admin.query('INSERT INTO tutor_subjects (tutor_id,subject,proficiency) VALUES ($1,$2,$3)', [tutor.id, subject, proficiency]);
}
async function addSlot(tutor, weekday, start = '16:00', end = '17:00') {
  await admin.query('INSERT INTO availability_slots (tutor_id,weekday,start_time,end_time) VALUES ($1,$2,$3,$4)', [tutor.id, weekday, start, end]);
}

// A future Monday 16:30 IST (campus time), at least a week away so it is always upcoming.
function nextMondayIst(hour = 16, minute = 30, weeksAhead = 1) {
  const d = new Date(Date.now() + weeksAhead * 7 * 86_400_000);
  const shifted = new Date(d.getTime() + 330 * 60_000);
  const dow = shifted.getUTCDay() || 7;
  const monday = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + (1 - dow));
  return new Date(monday + (hour * 60 + minute) * 60_000 - 330 * 60_000);
}

async function createRequest(learner, subject = 'maths', when = nextMondayIst()) {
  const res = await api().post('/api/requests').set(as(learner))
    .send({ subject, topic: 'Integration by parts', preferredTime: when.toISOString(), urgency: 'Normal' });
  return res.body;
}

const closeAll = async () => { await admin.end(); await require('../src/dal/pool').pool.end(); };

module.exports = { closeAll, api, as, tokenFor, admin, resetDb, makeUser, addSubject, addSlot, nextMondayIst, createRequest, PASSWORD, app };
