// SR-01: the reverse proxy terminates TLS and sets X-Forwarded-Proto. Anything else is redirected.
module.exports = (req, res, next) => {
  if (!req.app.get('enforceHttps')) return next();
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  if (proto === 'https') return next();
  return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
};
