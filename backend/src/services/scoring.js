// Pure match-score maths (FR-06, FR-07, FR-15) so it can be unit-tested without a database.
const SUBJECT_POINTS = 50;
const AVAILABILITY_POINTS = { covers: 30, sameDay: 15, none: 0 };
const PROFICIENCY_POINTS = { Beginner: 7, Intermediate: 13, Advanced: 20 };
const MIN_RATINGS_FOR_BONUS = 3;
const MAX_BONUS = 10;

const round1 = (n) => Math.round(n * 10) / 10;

// candidate: { proficiency, covers, same_day, avg_rating, rating_count }
function calculateScore(c) {
  const subject = SUBJECT_POINTS; // candidates are pre-filtered to tutors who teach the subject
  const availability = c.covers ? AVAILABILITY_POINTS.covers : c.same_day ? AVAILABILITY_POINTS.sameDay : AVAILABILITY_POINTS.none;
  const proficiency = PROFICIENCY_POINTS[c.proficiency] ?? 0;
  const bonus = c.rating_count >= MIN_RATINGS_FOR_BONUS ? round1((c.avg_rating / 5) * MAX_BONUS) : 0;
  const total = Math.min(100, round1(subject + availability + proficiency + bonus));
  return { total, breakdown: { subject, availability, proficiency, ratingBonus: bonus } };
}

function rank(candidates, limit = 5) {
  return candidates
    .map((c) => ({ ...c, score: calculateScore(c) }))
    .sort((a, b) => b.score.total - a.score.total || b.rating_count - a.rating_count || a.id - b.id)
    .slice(0, limit);
}

module.exports = { calculateScore, rank, SUBJECT_POINTS, PROFICIENCY_POINTS, AVAILABILITY_POINTS };
