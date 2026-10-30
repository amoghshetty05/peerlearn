// Step 2: token check. Loads the current user so suspended or logged-out accounts lose access at once.
const jwt = require('jsonwebtoken');
const config = require('../config');
const users = require('../dal/users');
const { E } = require('../errors');

module.exports = async function authenticate(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ') || h.length < 8) throw E.unauthenticated();
    let payload;
    try {
      payload = jwt.verify(h.slice(7), config.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw E.tokenExpired();
      throw E.unauthenticated('Your login token is not valid.');
    }
    const user = await users.findForToken(Number(payload.sub), payload.jti);
    if (!user || user.revoked) throw E.unauthenticated('Your login token is not valid.');
    if (user.status === 'suspended') throw E.suspended();
    req.user = user;
    req.token = { jti: payload.jti, exp: payload.exp };
    next();
  } catch (err) { next(err); }
};
