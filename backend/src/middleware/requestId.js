const crypto = require('crypto');
module.exports = (req, res, next) => {
  const incoming = String(req.headers['x-request-id'] || '');
  req.id = /^[A-Za-z0-9-]{4,40}$/.test(incoming) ? incoming : crypto.randomBytes(3).toString('hex');
  res.setHeader('X-Request-Id', req.id);
  next();
};
