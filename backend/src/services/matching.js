// CMP-05 Matching Service: help requests and ranked matches (FR-05, FR-06, FR-07, FR-15).
const requests = require('../dal/requests');
const tutors = require('../dal/tutors');
const { rank } = require('./scoring');
const smartMatch = require('./smartMatch');
const { localParts, nextOccurrences, toIst } = require('../utils/time');
const clock = require('../utils/clock');
const { E } = require('../errors');
const ser = require('../serializers');

exports.createRequest = async (learnerId, body) => {
  if (body.preferredTime <= clock.now()) throw E.validation('Preferred time must be in the future.');
  const row = await requests.create({
    learnerId, subject: body.subject, topic: body.topic, preferredTime: body.preferredTime, urgency: body.urgency,
  });
  return ser.request(row);
};

exports.listRequests = async (learnerId) => (await requests.listForLearner(learnerId)).map(ser.request);

exports.getMatches = async (learnerId, requestId) => {
  const req = await requests.findById(requestId);
  if (!req || req.learner_id !== learnerId) throw E.notFound('Help request not found.');

  const { isoWeekday, minutes } = localParts(new Date(req.preferred_time));
  const candidates = await tutors.matchCandidates(req.subject, isoWeekday, minutes);
  const now = clock.now();
  const top = rank(candidates, 5);
  const slots = top.length ? await tutors.slotsFor(top.map((t) => t.id)) : [];

  // FR-16: predicted chance of a successful session; the rule score keeps deciding the order (FR-07),
  // the prediction breaks ties between Tutors with the same score.
  const prediction = await smartMatch.predict(top.map((t) => smartMatch.features(t, req, now)));
  top.forEach((t, i) => { t.successChance = prediction ? Math.round(prediction.probabilities[i] * 100) : null; });
  top.sort((a, b) => b.score.total - a.score.total || (b.successChance ?? 0) - (a.successChance ?? 0));

  return {
    requestId: req.id,
    smartMatch: prediction ? { model: prediction.model, modelName: prediction.modelName } : null,
    matches: top.map((t) => ({
      tutorId: t.id,
      name: t.name,
      proficiency: t.proficiency,
      score: t.score.total,
      breakdown: t.score.breakdown,
      successChance: t.successChance,
      rating: { average: t.rating_count ? Math.round(t.avg_rating * 100) / 100 : null, count: t.rating_count },
      availableSlots: slots.filter((s) => s.tutor_id === t.id).map((s) => ({
        id: s.id, weekday: s.weekday, startTime: s.start_time, endTime: s.end_time,
        upcoming: nextOccurrences(s, now, 2).map(toIst),
      })),
    })),
  };
};
