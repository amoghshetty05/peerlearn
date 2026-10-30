// Step 3: role check (SR-05).
const { E } = require('../errors');
module.exports = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(E.forbidden());
