const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const requestId = require('./middleware/requestId');
const enforceHttps = require('./middleware/enforceHttps');
const rateLimiter = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);                       // behind the nginx reverse proxy
  app.set('enforceHttps', config.enforceHttps);
  app.use(requestId);
  app.use(enforceHttps);
  app.use(helmet({ hsts: { maxAge: 31536000, includeSubDomains: true } }));
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','), maxAge: 600 }));
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/api', rateLimiter);                    // 1. rate limiter
  app.use(express.json({ limit: '50kb' }));
  app.use('/api', routes);                         // 2-5. token, role, validation, controller (per route)
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
