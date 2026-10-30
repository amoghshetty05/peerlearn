// One error type for every expected failure; the error middleware shapes the response (SAD 3.4).
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const E = {
  validation: (msg = 'Some of the information you entered is not valid.') => new AppError(400, 'VALIDATION_ERROR', msg),
  unauthenticated: (msg = 'Please log in to continue.') => new AppError(401, 'UNAUTHENTICATED', msg),
  tokenExpired: () => new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.'),
  forbidden: (msg = 'Your account is not allowed to do this.') => new AppError(403, 'FORBIDDEN', msg),
  suspended: () => new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended by a moderator.'),
  notFound: (msg = 'We could not find what you asked for.') => new AppError(404, 'NOT_FOUND', msg),
  conflict: (msg = 'This conflicts with existing data.') => new AppError(409, 'CONFLICT', msg),
  slotOverlap: () => new AppError(409, 'SLOT_OVERLAP', 'This slot overlaps an existing slot.'),
  groupFull: () => new AppError(409, 'GROUP_FULL', 'This study group is full.'),
  locked: () => new AppError(423, 'ACCOUNT_LOCKED', 'Too many failed logins. Try again in 15 minutes.'),
  rateLimited: () => new AppError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.'),
};

module.exports = { AppError, E };
