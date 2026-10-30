// Single error-handling middleware: one JSON shape, no stack traces or DB messages to the client (SAD 3.4).
const { AppError } = require('../errors');
const logger = require('../utils/logger');

const notFound = (req, res, next) => next(new AppError(404, 'NOT_FOUND', 'We could not find what you asked for.'));

function errorHandler(err, req, res, _next) {
  let e = err;
  if (!(e instanceof AppError)) {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err instanceof SyntaxError) {
      e = new AppError(400, 'VALIDATION_ERROR', 'The request body is not valid JSON or is too large.');
    } else if (err.code === '23505') {
      e = new AppError(409, 'CONFLICT', 'This already exists.');
    } else if (typeof err.code === 'string' && /^(22|23)/.test(err.code)) {
      e = new AppError(400, 'VALIDATION_ERROR', 'Some of the information you entered is not valid.');
    } else {
      logger.error('Unhandled error', { requestId: req.id, path: req.originalUrl, error: err.message, stack: err.stack });
      e = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
    }
  }
  if (e.status >= 500) logger.error('Server error', { requestId: req.id, code: e.code });
  else logger.warn('Request rejected', { requestId: req.id, code: e.code, status: e.status });
  res.status(e.status).json({ status: e.status, code: e.code, message: e.message, requestId: req.id });
}

module.exports = { notFound, errorHandler };
