// CMP-03 Auth Service: registration, login, bcrypt hashing, token issue, lockout, logout.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const users = require('../dal/users');
const audit = require('./audit');
const clock = require('../utils/clock');
const { E } = require('../errors');
const ser = require('../serializers');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', Math.max(10, config.bcryptCost));

exports.register = async ({ name, email, password, role, phone }) => {
  if (await users.findByEmail(email)) throw E.conflict('This email is already registered.');
  const passwordHash = await bcrypt.hash(password, config.bcryptCost);
  let user;
  try {
    user = await users.create({ name, email, passwordHash, role, phone });
  } catch (err) {
    if (err.code === '23505') throw E.conflict('This email is already registered.');
    throw err;
  }
  await audit.record(user.id, 'REGISTER');
  return ser.selfUser(user);
};

exports.login = async ({ email, password }) => {
  const now = clock.now();
  const user = await users.findByEmail(email);
  if (!user) { await bcrypt.compare(password, DUMMY_HASH); throw E.unauthenticated('Email or password is incorrect.'); }
  if (user.locked_until && new Date(user.locked_until) > now) throw E.locked();

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await users.recordFailedLogin(user.id, config.lockout.maxFailures, config.lockout.minutes, now);
    throw E.unauthenticated('Email or password is incorrect.');
  }
  if (user.status === 'suspended') throw E.suspended();

  await users.clearFailedLogins(user.id);
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: String(user.id), role: user.role, jti }, config.jwtSecret,
    { algorithm: 'HS256', expiresIn: config.tokenTtl });
  const { exp } = jwt.decode(token);
  await audit.record(user.id, 'LOGIN');
  return { token, expiresAt: new Date(exp * 1000).toISOString(), user: ser.publicUser(user) };
};

exports.logout = async (userId, { jti, exp }) => {
  await users.revokeToken(jti, new Date(exp * 1000));
  await audit.record(userId, 'LOGOUT');
};
