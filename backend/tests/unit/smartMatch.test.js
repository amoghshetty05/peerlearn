// FR-16 Smart Match client: feature building and safe fallback when the model service is unavailable.
const config = require('../../src/config');
const { features, predict } = require('../../src/services/smartMatch');

const now = new Date('2026-11-16T10:00:00+05:30');
const request = { urgency: 'High', preferred_time: '2026-11-23T16:00:00+05:30' }; // 7 days 6 hours ahead

describe('Smart Match features (same scale as ml/smartmatch/features.py)', () => {
  test('a free, rated, reliable Tutor', () => {
    const f = features({ proficiency: 'Advanced', covers: true, same_day: true, avg_rating: 4.5, rating_count: 4,
      accepted_count: 8, answered_count: 10, upcoming_week: 3 }, request, now);
    expect(f).toEqual({ proficiency: 1, time_fit: 1, rating_avg: 0.9, rating_count: 0.2, acceptance_rate: 0.75,
      load: 0.3, urgency: 1, lead_time: expect.closeTo(7.25 / 14, 6) });
  });

  test('a new Tutor with no history gets neutral values and every feature stays within 0..1', () => {
    const f = features({ proficiency: 'Beginner', covers: false, same_day: false, avg_rating: 0, rating_count: 0 },
      { urgency: 'Low', preferred_time: '2027-06-01T10:00:00+05:30' }, now);
    expect(f).toMatchObject({ proficiency: 0, time_fit: 0, rating_avg: 0, rating_count: 0, acceptance_rate: 0.5, load: 0, urgency: 0, lead_time: 1 });
    Object.values(f).forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
  });
});

describe('Smart Match predictions', () => {
  const rows = [{ a: 1 }, { a: 2 }];
  afterEach(() => { config.smartMatch.url = ''; });

  test('no service configured -> null, nothing is called', async () => {
    const fetchImpl = jest.fn();
    expect(await predict(rows, { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('service answers -> probabilities are returned', async () => {
    config.smartMatch.url = 'http://ml:8000';
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ model: 'logistic_regression', modelName: 'Logistic Regression', probabilities: [0.8, 0.4] }) });
    const out = await predict(rows, { fetchImpl });
    expect(out.probabilities).toEqual([0.8, 0.4]);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://ml:8000/predict');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ rows });
  });

  test.each([
    ['service down', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['server error', () => Promise.resolve({ ok: false, status: 500 })],
    ['wrong number of results', () => Promise.resolve({ ok: true, json: async () => ({ probabilities: [0.5] }) })],
  ])('%s -> null, matching continues without predictions', async (_name, impl) => {
    config.smartMatch.url = 'http://ml:8000';
    expect(await predict(rows, { fetchImpl: jest.fn(impl) })).toBeNull();
  });
});
