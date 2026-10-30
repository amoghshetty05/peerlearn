const { calculateScore, rank } = require('../../src/services/scoring');

const base = { proficiency: 'Advanced', covers: true, same_day: true, avg_rating: 0, rating_count: 0 };

describe('match score (FR-06, FR-15)', () => {
  test('full marks without rating bonus is 100', () => {
    expect(calculateScore(base).total).toBe(100);
  });
  test('availability: covers 30, same day 15, none 0', () => {
    expect(calculateScore({ ...base, proficiency: 'Beginner' }).breakdown.availability).toBe(30);
    expect(calculateScore({ ...base, covers: false }).breakdown.availability).toBe(15);
    expect(calculateScore({ ...base, covers: false, same_day: false }).breakdown.availability).toBe(0);
  });
  test('proficiency maps to 7 / 13 / 20 of the 20 points', () => {
    expect(['Beginner', 'Intermediate', 'Advanced'].map((p) => calculateScore({ ...base, proficiency: p }).breakdown.proficiency)).toEqual([7, 13, 20]);
  });
  test('rating bonus needs 3 ratings and equals avg/5*10', () => {
    const lowBase = { ...base, proficiency: 'Beginner', covers: false, same_day: false };
    expect(calculateScore({ ...lowBase, avg_rating: 5, rating_count: 2 }).breakdown.ratingBonus).toBe(0);
    expect(calculateScore({ ...lowBase, avg_rating: 4, rating_count: 3 }).breakdown.ratingBonus).toBe(8);
    expect(calculateScore({ ...lowBase, avg_rating: 5, rating_count: 3 }).total).toBe(67);
  });
  test('total is capped at 100', () => {
    expect(calculateScore({ ...base, avg_rating: 5, rating_count: 10 }).total).toBe(100);
  });
  test('rank returns at most 5, descending, ties broken by rating count then id', () => {
    const list = Array.from({ length: 8 }, (_, i) => ({ ...base, id: i + 1, proficiency: i % 2 ? 'Beginner' : 'Advanced' }));
    const out = rank(list);
    expect(out).toHaveLength(5);
    const totals = out.map((o) => o.score.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
    expect(out[0].id).toBe(1);
  });
});
