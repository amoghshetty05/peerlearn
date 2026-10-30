// Step 1 of the fixed middleware order (SAD 2.4): 100 requests / minute / user (NFR-04).
const jwt = require('jsonwebtoken');
const config = require('../config');
const { E } = require('../errors');

const buckets = new Map();

function keyFor(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const p = jwt.verify(h.slice(7), config.jwtSecret, { algorithms: ['HS256'], ignoreExpiration: true });
      return `u:${p.sub}`; // signature checked, so a forged token cannot burn someone else's quota
    } catch { /* fall through to IP */ }
  }
  return `ip:${req.ip}`;
}

function rateLimiter(req, res, next) {
  const now = Date.now();
  const key = keyFor(req);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) { b = { count: 0, resetAt: now + config.rateLimit.windowMs }; buckets.set(key, b); }
  b.count += 1;
  const max = key.startsWith('u:') ? config.rateLimit.max : config.rateLimit.anonMax;
  if (b.count > max) {
    res.setHeader('Retry-After', Math.ceil((b.resetAt - now) / 1000));
    return next(E.rateLimited());
  }
  next();
}

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60_000);
sweep.unref();

rateLimiter.reset = () => buckets.clear();
module.exports = rateLimiter;
