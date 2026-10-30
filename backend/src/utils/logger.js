// Structured logs; stack traces and DB messages go here only, never to the client (SAD 3.4).
const config = require('../config');
function log(level, msg, extra = {}) {
  if (config.isTest && level !== 'error') return;
  if (config.isTest && process.env.TEST_LOG !== '1') return;
  console[level === 'error' ? 'error' : 'log'](JSON.stringify({ level, time: new Date().toISOString(), msg, ...extra }));
}
module.exports = {
  info: (m, e) => log('info', m, e),
  warn: (m, e) => log('warn', m, e),
  error: (m, e) => log('error', m, e),
};
