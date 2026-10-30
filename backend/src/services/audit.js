// CMP-10 Audit Logger: append-only. There is deliberately no update or delete function here (SR-07).
const audit = require('../dal/audit');
exports.record = (userId, action, client) => audit.append(userId, action, client);
exports.list = audit.list;
