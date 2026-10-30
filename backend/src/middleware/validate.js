// Step 4: input validation (SR-06). Parsed values replace the raw input.
const { E } = require('../errors');

const LABELS = {
  name: 'Name', email: 'Email', password: 'Password', phone: 'Phone number', subject: 'Subject', topic: 'Topic',
  proficiency: 'Proficiency', weekday: 'Weekday', startTime: 'Start time', endTime: 'End time', urgency: 'Urgency',
  preferredTime: 'Preferred time', slotTime: 'Slot time', requestId: 'Request', tutorId: 'Tutor', status: 'Status',
  score: 'Score', comment: 'Comment', maxSize: 'Group size', reason: 'Reason', reportedId: 'User', action: 'Action', id: 'Id',
};
// zod's own technical wording starts with these; our custom messages (set in schemas.js) do not.
const GENERIC = /^(Invalid|Too small|Too big|Required|Expected)/;

// Turns zod's technical messages into plain sentences; our own custom messages pass through unchanged.
function plain(issue) {
  const field = String(issue.path[issue.path.length - 1] ?? 'Input');
  const label = LABELS[field] || field;
  if (!GENERIC.test(issue.message)) return issue.message;
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string') return issue.minimum <= 1 ? `${label} is required.` : `${label} must be at least ${issue.minimum} characters.`;
      return `${label} must be at least ${issue.minimum}.`;
    case 'too_big':
      return issue.origin === 'string' ? `${label} must be at most ${issue.maximum} characters.` : `${label} must be at most ${issue.maximum}.`;
    case 'invalid_type':
      return /received undefined/.test(issue.message) ? `${label} is required.` : `${label} is not in the expected format.`;
    case 'invalid_value':
      return `${label} must be one of: ${(issue.values || []).join(', ')}.`;
    case 'invalid_format':
      return issue.format === 'datetime' ? `${label} must be a valid date and time.` : `${label} is not in the expected format.`;
    default:
      return `${label} is not valid.`;
  }
}

module.exports = (shape) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!shape[part]) continue;
    const parsed = shape[part].safeParse(req[part] ?? {});
    if (!parsed.success) return next(E.validation(plain(parsed.error.issues[0])));
    req[part] = parsed.data;
  }
  next();
};
