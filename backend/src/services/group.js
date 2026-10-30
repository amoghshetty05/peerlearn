// CMP-07 Study Group Service (FR-10).
const groups = require('../dal/groups');
const { tx } = require('../dal/pool');
const { E } = require('../errors');
const ser = require('../serializers');

exports.create = async (user, { name, subject, maxSize }) => {
  const g = await groups.create({ name, subject, maxSize, ownerId: user.id });
  return ser.group(await groups.findWithCount(g.id, user.id));
};

exports.list = async (user, subject) => (await groups.list(user.id, subject)).map(ser.group);

exports.get = async (user, id) => {
  const g = await groups.findWithCount(id, user.id);
  if (!g) throw E.notFound('Study group not found.');
  return { ...ser.group(g), members: await groups.members(id) };
};

exports.join = (user, id) => tx(async (c) => {
  const g = await groups.lockGroup(id, c); // row lock: two people cannot take the last seat together
  if (!g) throw E.notFound('Study group not found.');
  if (await groups.isMember(id, user.id, c)) throw E.conflict('You are already in this group.');
  if (await groups.memberCount(id, c) >= g.max_size) throw E.groupFull();
  await groups.addMember(id, user.id, c);
  return ser.group(await groups.findWithCount(id, user.id, c));
});

exports.leave = async (user, id) => {
  if (!(await groups.removeMember(id, user.id))) throw E.notFound('You are not a member of this group.');
  return ser.group(await groups.findWithCount(id, user.id));
};
